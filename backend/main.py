from fastapi import FastAPI, Depends, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from uuid import uuid4
from fastapi.websockets import WebSocketDisconnect

# Include your routers:
from .routers.matches import router as matches_router
from .routers.rooms import router as rooms_router
from .auth import get_current_user, verify_password, get_password_hash, create_access_token, user_table

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Allow both localhost and 127.0.0.1
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[room_id] = websocket

    def disconnect(self, room_id: str):
        if room_id in self.active_connections:
            del self.active_connections[room_id]

    async def send_message(self, room_id: str, message: str):
        if room_id in self.active_connections:
            await self.active_connections[room_id].send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/rooms/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    # Set CORS headers for WebSocket connection
    origin = websocket.headers.get("origin")
    if origin not in ["http://localhost:3000", "http://127.0.0.1:3000"]:
        await websocket.close(code=1008)  # Policy Violation
        return
        
    await websocket.accept()
    await manager.connect(room_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_message(room_id, f"Message received: {data}")
    except WebSocketDisconnect:
        manager.disconnect(room_id)

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


@app.post("/api/v1/register", response_model=Token)
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


@app.post("/api/v1/login", response_model=Token)
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


@app.get("/api/v1/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "email": current_user["email"]}
