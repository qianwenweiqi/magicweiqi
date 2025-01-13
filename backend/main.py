from fastapi import FastAPI, Depends, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from uuid import uuid4
from fastapi.websockets import WebSocketDisconnect
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize match service first to ensure it's loaded before routers
from backend.services.match_service import get_matches
logger.info("Initializing match service")
matches = get_matches()
logger.info(f"Initial matches state: {list(matches.keys())}")

# Include your routers:
from routers.matches import router as matches_router
from routers.rooms import router as rooms_router
from backend.auth import get_current_user, verify_password, get_password_hash, create_access_token, user_table

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
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.active_connections:
            self.active_connections[room_id] = [
                ws for ws in self.active_connections[room_id] 
                if ws != websocket
            ]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def send_message(self, room_id: str, message: dict, target_websocket: WebSocket = None):
        """
        Send a message to either a specific WebSocket connection or broadcast to all connections in a room.
        If target_websocket is provided, send only to that connection.
        Otherwise, broadcast to all connections in the room.
        """
        if room_id not in self.active_connections:
            logger.warning(f"No active connections for room {room_id}")
            return
            
        import json
        message_text = json.dumps(message)
        
        if target_websocket:
            # Send to specific connection only
            try:
                await target_websocket.send_text(message_text)
                logger.info(f"Message sent successfully to specific client in room {room_id}")
            except Exception as e:
                logger.error(f"Error sending message to specific client in room {room_id}: {str(e)}")
                self.disconnect(room_id, target_websocket)
        else:
            # Broadcast to all connections
            logger.info(f"Broadcasting to room {room_id}, active connections: {len(self.active_connections[room_id])}")
            
            disconnected = []
            successful = 0
            for websocket in self.active_connections[room_id]:
                try:
                    await websocket.send_text(message_text)
                    successful += 1
                except Exception as e:
                    logger.error(f"Error sending message to client in room {room_id}: {str(e)}")
                    disconnected.append(websocket)
            
            # Clean up disconnected clients
            if disconnected:
                logger.info(f"Cleaning up {len(disconnected)} disconnected clients from room {room_id}")
                for ws in disconnected:
                    self.disconnect(room_id, ws)

# WebSocket managers
room_manager = ConnectionManager()
game_manager = ConnectionManager()

@app.websocket("/ws/games/{match_id}")
async def game_websocket_endpoint(websocket: WebSocket, match_id: str):
    origin = websocket.headers.get("origin")
    if origin not in ["http://localhost:3000", "http://127.0.0.1:3000"]:
        await websocket.close(code=1008)
        return
    
    logger.info(f"New game WebSocket connection request for match {match_id}")
    await game_manager.connect(match_id, websocket)
    matches = get_matches()
    logger.info(f"Game WebSocket connected for match {match_id}. Active connections: {len(game_manager.active_connections.get(match_id, []))}")
    
    # Send initial game state
    if match_id in matches:
        try:
            game = matches[match_id]
            logger.info(f"Sending initial game state for match {match_id}")
            await game_manager.send_message(match_id, {
                "type": "game_update",
                "board": game.board,
                "current_player": game.current_player,
                "black_player": game.black_player,
                "white_player": game.white_player,
                "game_over": game.game_over,
                "winner": game.winner,
                "captured": game.captured,
                "passes": game.passes,
                "history_length": len(game.history),
                "black_timer": game.timers["black"],
                "white_timer": game.timers["white"]
            })
            logger.info(f"Initial game state sent successfully for match {match_id}")
        except Exception as e:
            logger.error(f"Error sending initial game state: {e}")
            await websocket.close(code=1011)  # Internal Error
            return
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received WebSocket message from match {match_id}: {data}")
            await game_manager.send_message(match_id, {"type": "message_received", "data": data})
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for match {match_id}")
        game_manager.disconnect(match_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error for match {match_id}: {e}")
        game_manager.disconnect(match_id, websocket)

@app.websocket("/ws/rooms/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    # Set CORS headers for WebSocket connection
    origin = websocket.headers.get("origin")
    if origin not in ["http://localhost:3000", "http://127.0.0.1:3000"]:
        await websocket.close(code=1008)  # Policy Violation
        return
    
    logger.info(f"New room WebSocket connection request for room {room_id}")
    await room_manager.connect(room_id, websocket)
    logger.info(f"Room WebSocket connected for room {room_id}. Active connections: {len(room_manager.active_connections.get(room_id, []))}")
    
    # Send initial room state only to this connection
    from routers.rooms import rooms, get_player_info
    from backend.services.match_service import get_matches
    matches = get_matches()
    
    if room_id in rooms:
        try:
            room = rooms[room_id]
            match_id = room.get("match_id")
            
            logger.info(f"Sending initial room state to new connection for room {room_id}")
            await room_manager.send_message(room_id, {
                "type": "room_update",
                "players": [get_player_info(p) for p in room["players"]],
                "ready": room["ready"],
                "started": room["started"],
                "match_id": match_id
            }, target_websocket=websocket)
            logger.info(f"Initial room state sent successfully to new connection for room {room_id}")
        except Exception as e:
            logger.error(f"Error sending initial room state: {e}")
            await websocket.close(code=1011)  # Internal Error
            return
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received WebSocket message from room {room_id}: {data}")
            await room_manager.send_message(room_id, {"type": "message_received", "data": data})
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for room {room_id}")
        room_manager.disconnect(room_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error for room {room_id}: {e}")
        room_manager.disconnect(room_id, websocket)

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
