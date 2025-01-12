from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from uuid import uuid4

# Include your routers:
from backend.routers.matches import router as matches_router
from backend.routers.rooms import router as rooms_router
from backend.auth import get_current_user, verify_password, get_password_hash, create_access_token, user_table

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust for your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Include the routers under /api/v1
app.include_router(matches_router, prefix="/api/v1")
app.include_router(rooms_router, prefix="/api/v1")


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
