from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from uuid import uuid4
import boto3
import os

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust this for your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DynamoDB setup
dynamodb = boto3.resource("dynamodb", region_name="ap-east-1")
user_table = dynamodb.Table("user_passwords")  # Ensure this table exists

# Password hashing and JWT configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET", "your_secret_key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Dummy data for matches
dummy_matches = {}

# OAuth2 for token-based authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Move(BaseModel):
    x: int | None
    y: int | None

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Special case for test user
    if username == "test":
        return {"username": "test", "email": "test@example.com"}

    # Check in DynamoDB
    response = user_table.get_item(Key={"username": username})
    user = response.get("Item")
    if not user:
        raise credentials_exception
    return user

# Routes
@app.post("/register", response_model=Token)
async def register(user: UserCreate):
    # Check if the username already exists
    response = user_table.get_item(Key={"username": user.username})
    if "Item" in response:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = get_password_hash(user.password)
    user_table.put_item(
        Item={
            "username": user.username,
            "email": user.email,
            "password": hashed_password,
        }
    )

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/login", response_model=Token)
async def login(user: UserLogin):
    # Special case for test user
    if user.username == "test" and user.password == "test":
        access_token = create_access_token(data={"sub": "test"})
        return {"access_token": access_token, "token_type": "bearer"}

    # Validate credentials against DynamoDB
    response = user_table.get_item(Key={"username": user.username})
    db_user = response.get("Item")
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "email": current_user["email"]}

@app.post("/api/v1/matches")
async def create_or_get_match(current_user: dict = Depends(get_current_user)):
    # Special case for test user
    if current_user["username"] == "test":
        if "test-match" not in dummy_matches:
            dummy_matches["test-match"] = {
                "board": [[None for _ in range(19)] for _ in range(19)],
                "current_player": "black",
                "black_player": {"player_id": "black", "elo": 1200, "avatar_url": ""},
                "white_player": {"player_id": "white", "elo": 1200, "avatar_url": ""},
            }
        return {
            "match_id": "test-match",
            "board": dummy_matches["test-match"]["board"],
            "current_player": "black",
        }

    # Default behavior for non-test users
    match_id = str(uuid4())
    dummy_matches[match_id] = {
        "board": [[None for _ in range(19)] for _ in range(19)],
        "current_player": "black",
        "black_player": {"player_id": "black", "elo": 1200, "avatar_url": ""},
        "white_player": {"player_id": "white", "elo": 1200, "avatar_url": ""},
    }
    return {
        "match_id": match_id,
        "board": dummy_matches[match_id]["board"],
        "current_player": "black",
    }

@app.post("/api/v1/matches/{match_id}/move")
async def make_move(match_id: str, move: Move, current_user: dict = Depends(get_current_user)):
    match = dummy_matches.get(match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if move.x is None or move.y is None:
        match["current_player"] = "white" if match["current_player"] == "black" else "black"
        return {
            "board": match["board"],
            "current_player": match["current_player"],
            "message": "Move passed",
        }

    match["board"][move.x][move.y] = match["current_player"]
    match["current_player"] = "white" if match["current_player"] == "black" else "black"
    return {
        "board": match["board"],
        "current_player": match["current_player"],
        "message": "Move made",
    }

@app.get("/api/v1/matches/{match_id}/players")
async def get_match_players(match_id: str):
    match = dummy_matches.get(match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return {
        "players": [match["black_player"], match["white_player"]],
        "black_cards": [],
        "white_cards": [],
    }
