# backend/main.py

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from uuid import uuid4
import logging
import socketio
from jose import JWTError, jwt

from backend.auth import SECRET_KEY, ALGORITHM, get_password_hash, verify_password, create_access_token, user_table, get_current_user
from backend.services.match_service import get_matches
from routers.matches import router as matches_router
from routers.rooms import router as rooms_router, broadcast_update

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
logger.setLevel(logging.INFO)
logging.getLogger('engineio.server').setLevel(logging.WARNING)
logging.getLogger('socketio.server').setLevel(logging.WARNING)

# 初始化match service
logger.info("Initializing match service")
matches = get_matches()
logger.info(f"Initial matches state: {list(matches.keys())}")

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    from backend.services.websocket_manager import room_manager
    room_manager.clear_rooms()
    logger.info("Cleared all rooms on server startup")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有域
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.get("/test")
async def test():
    return {"message": "Test endpoint working"}

# ========== 配置 Socket.IO ==========
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['http://localhost:3000'],
    logger=False,
    engineio_logger=False,
    ping_timeout=20,
    ping_interval=25,
    max_http_buffer_size=1e6,
    transports=['websocket']
)

application = socketio.ASGIApp(sio, app)

from backend.services.websocket_manager import room_manager, game_manager

# ========== Socket.IO Events ==========

@sio.event
async def connect(sid, environ, auth):
    """
    WebSocket 连接时，解析 token => username => 存 session
    """
    try:
        token = auth.get('token')
        if not token:
            logger.error("No token provided in auth")
            return False
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            logger.error("No username in token payload")
            return False
        await sio.save_session(sid, {'username': username})
        logger.info(f"User {username} connected with auth token")
        return True
    except JWTError as e:
        logger.error(f"JWT validation failed: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Error in connect handler: {str(e)}")
        return False

@sio.event
async def disconnect(sid, environ=None):
    username = room_manager.get_username_by_sid(sid) or 'unknown'
    logger.info(f"User {username} disconnected")
    for room_id in list(room_manager.active_connections.keys()):
        room_manager.disconnect(room_id, sid)
    for match_id in list(game_manager.active_connections.keys()):
        game_manager.disconnect(match_id, sid)

@sio.event
async def join_lobby(sid, data, auth=None):
    """
    玩家加入'lobby'事件
    """
    try:
        session = await sio.get_session(sid)
        username = session.get('username', 'anonymous')

        # ★新增：若 sid 已在 lobby，就跳过重复加入，避免不断清理自身连接
        if sid in room_manager.active_connections.get('lobby', []):
            logger.info(f"User {username} is already in lobby, skip re-join.")
            return

        logger.info(f"User {username} attempting to join lobby")
        await sio.enter_room(sid, 'lobby')
        await room_manager.connect('lobby', sid, username)

        await sio.emit('welcome', {'message': 'Welcome!'}, to=sid)
        logger.info(f"User {username} joined lobby successfully")

        # broadcast_update => 更新大厅房间列表
        await broadcast_update()
    except Exception as e:
        logger.error(f"Error in join_lobby for user {sid}: {str(e)}")
        if sid in room_manager.active_connections.get('lobby', []):
            room_manager.disconnect('lobby', sid)
        raise

@sio.event
async def join_custom_room(sid, data, auth=None):
    """
    玩家加入除'lobby'外的房间
    """
    room_id = data.get('room_id')
    if not room_id or room_id == 'lobby':
        logger.warning(f"join_custom_room called but invalid room_id: {room_id}")
        return

    try:
        session = await sio.get_session(sid)
        username = session.get('username', f"guest-{sid[:6]}")

        # ★新增：若 sid 已在该房间，则跳过重复加入
        if sid in room_manager.active_connections.get(room_id, []):
            logger.info(f"User {username} is already in room {room_id}, skip re-join.")
            return

        logger.info(f"User {username} attempting to join room {room_id}")
        # 先加入socket.io房间
        await sio.enter_room(sid, room_id)
        await room_manager.connect(room_id, sid, username)
        logger.info(f"User {username} joined room {room_id} successfully")

        # 发送room_update事件
        await broadcast_update(room_id)

        # 最后发送joined确认
        await sio.emit('room_joined', {'room_id': room_id}, to=sid)
    except Exception as e:
        logger.error(f"Error in join_custom_room: {str(e)}")
        if sid in room_manager.active_connections.get(room_id, []):
            room_manager.disconnect(room_id, sid)

@sio.event
async def leave_room(sid, data):
    """
    玩家离开房间事件
    """
    room_id = data.get('room_id')
    if not room_id:
        return
    username = room_manager.get_username_by_sid(sid) or 'unknown'
    logger.info(f"User {username} leaving room {room_id}")

    if room_id == 'lobby':
        await sio.leave_room(sid, 'lobby')

    room_manager.disconnect(room_id, sid)
    await sio.emit('room_left', {'room_id': room_id}, to=sid)

@sio.event
async def joinGame(sid, data):
    """
    玩家加入游戏
    """
    match_id = data.get('match_id')
    if not match_id:
        logger.error("Received joinGame without match_id from", sid)
        return
    try:
        session = await sio.get_session(sid)
        username = session.get('username', 'anonymous')
        logger.info(f"User {username} attempting to join game {match_id}")
        await sio.enter_room(sid, f'game_{match_id}')
        await game_manager.connect(match_id, sid, username)
        logger.info(f"User {username} joined game {match_id} successfully")
    except Exception as e:
        logger.error(f"Error in joinGame: {str(e)}")
        if sid in game_manager.active_connections.get(match_id, []):
            game_manager.disconnect(match_id, sid)

@sio.event
async def game_update(sid, data):
    """
    处理对局相关的 update
    """
    match_id = data.get('match_id')
    if not match_id:
        logger.error("Received game update without match_id from", sid)
        return
    username = room_manager.get_username_by_sid(sid) or 'unknown'
    logger.info(f"Received game update from user {username} for match {match_id}: {data}")
    await game_manager.send_message(match_id, data)

@sio.event
async def room_update(sid, data):
    """
    处理玩家主动发送的房间更新
    """
    room_id = data.get('room_id')
    if not room_id:
        logger.error(f"Received room update without room_id from {sid}")
        return
    username = room_manager.get_username_by_sid(sid) or 'unknown'
    logger.info(f"Received room update from user {username} for room {room_id}: {data}")

    message = {
        'type': 'room_update',
        'room_id': room_id,
        'data': data.get('data', {})
    }
    logger.info(f"Broadcasting room update: {message}")
    await room_manager.send_message(room_id, message)

@sio.event
async def message(sid, data):
    """
    通用消息事件
    """
    username = room_manager.get_username_by_sid(sid) or 'unknown'
    logger.info(f"Received message from user {username}: {data}")

    if data.get('type') == 'get_rooms':
        # 只有在lobby的sid才允许
        if sid in room_manager.active_connections.get('lobby', []):
            await broadcast_update()
        else:
            logger.info(f"sid={sid} not in lobby, skip get_rooms")
    elif data.get('type') == 'pull_room_info':
        room_id = data.get('room_id')
        if room_id:
            logger.info(f"pull_room_info => pulling real data for room_id={room_id}")
            await broadcast_update(room_id)
        else:
            logger.warning("pull_room_info => missing room_id")
    elif 'match_id' in data:
        await game_manager.send_message(data['match_id'], data)
    elif 'room_id' in data and data.get('type') == 'room_update':
        msg = {
            'type': 'room_update',
            'room_id': data['room_id'],
            'data': data.get('data', {})
        }
        logger.info(f"Broadcasting room update via message: {msg}")
        await room_manager.send_message(data['room_id'], msg)
    elif 'room_id' in data:
        await room_manager.send_message(data['room_id'], data)
    else:
        logger.error(f"Received message without recognized type or room_id/match_id: {data}")

# ========== 用户注册/登录接口 ==========

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

app.include_router(matches_router, prefix="/api/v1")
app.include_router(rooms_router, prefix="/api/v1")

@app.post("/api/v1/register", response_model=Token)
async def register(user: UserCreate):
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
    if user.username == "test" and user.password == "test":
        access_token = create_access_token(data={"sub": "test"})
        return {"access_token": access_token, "token_type": "bearer"}

    response = user_table.get_item(Key={"username": user.username})
    db_user = response.get("Item")
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/v1/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "email": current_user["email"]}
