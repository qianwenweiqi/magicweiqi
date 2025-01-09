from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
import boto3
import os
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer

# Initialize FastAPI app
app = FastAPI()

# Add CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DynamoDB setup
dynamodb = boto3.resource("dynamodb", region_name="ap-east-1")
user_table = dynamodb.Table("user_passwords")
matches_table = dynamodb.Table("matches")  # Add this for match-related data

# Password hashing and JWT configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET", "your_secret_key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2 for token-based authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Pydantic models for request and response validation
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

class MatchRequest(BaseModel):
    board_size: int

class PlayerResponse(BaseModel):
    player_id: str
    is_black: bool
    elo: int
    avatar_url: str

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

    response = user_table.get_item(Key={"username": username})
    user = response.get("Item")
    if not user:
        raise credentials_exception
    return user

# Routes
@app.post("/register", response_model=Token)
async def register(user: UserCreate):
    # Check if username exists
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
    response = user_table.get_item(Key={"username": user.username})
    db_user = response.get("Item")

    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "email": current_user["email"]}

@app.post("/api/v1/matches")
async def create_match(request: MatchRequest, current_user: dict = Depends(get_current_user)):
    match_id = f"match-{datetime.utcnow().timestamp()}"  # Generate unique match ID
    board = [[None] * request.board_size for _ in range(request.board_size)]  # Initialize empty board

    matches_table.put_item(
        Item={
            "match_id": match_id,
            "board": board,
            "current_player": "black",
            "players": [
                {"player_id": current_user["username"], "is_black": True, "elo": 1200, "avatar_url": ""},
            ],
        }
    )

    return {
        "match_id": match_id,
        "board": board,
        "current_player": "black",
    }

@app.get("/api/v1/matches/{match_id}/players")
async def get_match_players(match_id: str, current_user: dict = Depends(get_current_user)):
    response = matches_table.get_item(Key={"match_id": match_id})
    match = response.get("Item")

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    return {
        "players": match["players"],
        "black_cards": match.get("black_cards", []),
        "white_cards": match.get("white_cards", []),
    }
