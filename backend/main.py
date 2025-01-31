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

#######################
# 初始化 match service
#######################
logger.info("Initializing match service")
matches = get_matches()
logger.info(f"Initial matches state: {list(matches.keys())}")

############
# 创建FastAPI
############
app = FastAPI()

################
# 初始化 Socket.IO
################
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

###################################################
# 由websocket_manager.py提供的初始化函数
###################################################
from backend.services.websocket_manager import init_room_manager, init_game_manager

# 初始化全局的 room_manager 和 game_manager
room_manager = init_room_manager(sio)
game_manager = init_game_manager(sio)

########################################
# 设置启动事件，清空room_manager数据
########################################
@app.on_event("startup")
async def startup_event():
    room_manager.clear_rooms()
    logger.info("Cleared all rooms on server startup")

########################################
# 加CORS中间件
########################################
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有域
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

##############
# 简单测试接口
##############
@app.get("/test")
async def test():
    return {"message": "Test endpoint working"}

###################################
# 包含 rooms路由、matches路由
###################################
app.include_router(matches_router, prefix="/api/v1")
app.include_router(rooms_router, prefix="/api/v1")

##############################
# 用户注册/登录的模型与接口
##############################
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

######################################
# 以下是 Socket.IO 事件回调区
######################################
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
    username = room_manager.get_username_by_sid(sid) or game_manager.get_username_by_sid(sid) or 'unknown'
    logger.info(f"User {username} disconnected")
    # 断开所有room
    for rid in list(room_manager.active_connections.keys()):
        room_manager.disconnect(rid, sid)
    # 断开所有match
    for mid in list(game_manager.active_connections.keys()):
        game_manager.disconnect(mid, sid)

@sio.event
async def join_lobby(sid, data, auth=None):
    try:
        session = await sio.get_session(sid)
        username = session.get('username', 'anonymous')

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
    room_id = data.get('room_id')
    if not room_id or room_id == 'lobby':
        logger.warning(f"join_custom_room called but invalid room_id: {room_id}")
        return

    try:
        session = await sio.get_session(sid)
        username = session.get('username', f"guest-{sid[:6]}")

        if sid in room_manager.active_connections.get(room_id, []):
            logger.info(f"User {username} is already in room {room_id}, skip re-join.")
            return

        logger.info(f"User {username} attempting to join room {room_id}")
        await sio.enter_room(sid, room_id)
        await room_manager.connect(room_id, sid, username)
        logger.info(f"User {username} joined room {room_id} successfully")

        # 发送room_update事件
        await broadcast_update(room_id)
        await sio.emit('room_joined', {'room_id': room_id}, to=sid)
    except Exception as e:
        logger.error(f"Error in join_custom_room: {str(e)}")
        if sid in room_manager.active_connections.get(room_id, []):
            room_manager.disconnect(room_id, sid)

@sio.event
async def leave_room(sid, data):
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
    match_id = data.get('match_id')
    if not match_id:
        logger.error("Received joinGame without match_id from sid=%s", sid)
        return

    from backend.services.match_service import get_matches
    try:
        session = await sio.get_session(sid)
        username = session.get('username', 'anonymous')
        logger.info(f"[joinGame] User {username} attempting to join game {match_id}")

        matches = get_matches()
        if match_id not in matches:
            logger.error(f"[joinGame] Match not found: {match_id}")
            return
        game = matches[match_id]
        if username not in (game.black_player, game.white_player):
            logger.error(f"[joinGame] User {username} is not a player in match {match_id}")
            return

        if sid in game_manager.active_connections.get(match_id, []):
            logger.info(f"[joinGame] User {username} is already in game {match_id}")
        else:
            await sio.enter_room(sid, f'game_{match_id}')
            await game_manager.connect(match_id, sid, username)
            logger.info(f"[joinGame] User {username} joined game {match_id} successfully")
            logger.info(f"[joinGame] Active connections for match: {game_manager.active_connections.get(match_id, [])}")
            logger.info(f"[joinGame] Socket.IO rooms for sid {sid}: {sio.rooms(sid)}")

        # 发送初始游戏状态
        game_state = {
            "type": "game_update",
            "match_id": match_id,
            "board": game.board,
            "current_player": game.current_player,
            "black_player": game.black_player,
            "white_player": game.white_player,
            "game_over": game.game_over,
            "winner": game.winner,
            "captured": game.captured,
            "black_timer": game.timers["black"],
            "white_timer": game.timers["white"]
        }
        logger.info(f"[joinGame] Sending initial game state to {username}")
        await game_manager.send_message(match_id, game_state, target_sid=sid)
    except Exception as e:
        logger.error(f"Error in joinGame: {str(e)}")
        if sid in game_manager.active_connections.get(match_id, []):
            game_manager.disconnect(match_id, sid)

@sio.event
async def message(sid, data):
    username = room_manager.get_username_by_sid(sid) or game_manager.get_username_by_sid(sid) or 'unknown'
    logger.info(f"Received message from user {username}: {data}")

    if data.get('type') == 'get_rooms':
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
        match_id = data['match_id']
        await game_manager.send_message(match_id, data)

    elif 'room_id' in data and data.get('type') == 'room_update':
        msg = {
            'type': 'room_update',
            'room_id': data['room_id'],
            'data': data.get('data', {})
        }
        logger.info(f"Broadcasting room update via message: {msg}")
        await room_manager.send_message(data['room_id'], msg)

    elif 'room_id' in data:
        room_id = data['room_id']
        await room_manager.send_message(room_id, data)

    else:
        logger.error(f"Received message without recognized type or room_id/match_id: {data}")


#############
# 对局事件
#############
@sio.event
async def move_stone(sid, data):
    from backend.services.match_service import get_matches
    session = await sio.get_session(sid)
    username = session.get('username', 'anonymous')
    match_id = data.get("match_id")
    x = data.get("x")
    y = data.get("y")

    if not match_id or x is None or y is None:
        logger.error(f"move_stone missing required fields. data={data}")
        return

    matches = get_matches()
    if match_id not in matches:
        logger.error(f"[move_stone] Match not found: {match_id}")
        return

    game = matches[match_id]
    logger.info(f"[move_stone] user={username} => match_id={match_id}, move=({x},{y})")

    if game.game_over:
        logger.info(f"[move_stone] Game {match_id} already over.")
        return

    current_color = game.current_player
    if (current_color == "black" and username != game.black_player) or \
       (current_color == "white" and username != game.white_player):
        logger.info(f"[move_stone] Not {username}'s turn.")
        error_msg = {
            "type": "game_update",
            "match_id": match_id,
            "board": game.board,
            "current_player": game.current_player,
            "black_player": game.black_player,
            "white_player": game.white_player,
            "game_over": game.game_over,
            "winner": game.winner,
            "captured": game.captured,
            "black_timer": game.timers["black"],
            "white_timer": game.timers["white"],
            "error": "Not your turn"
        }
        await game_manager.send_message(match_id, error_msg)
        return

    logger.info(f"[move_stone] Attempting move at ({x}, {y}) for {username} in match {match_id}")
    success, message = game.play_move(x, y)
    if not success:
        logger.info(f"[move_stone] Move invalid: {message}")
        error_msg = {
            "type": "game_update",
            "match_id": match_id,
            "board": game.board,
            "current_player": game.current_player,
            "black_player": game.black_player,
            "white_player": game.white_player,
            "game_over": game.game_over,
            "winner": game.winner,
            "captured": game.captured,
            "black_timer": game.timers["black"],
            "white_timer": game.timers["white"],
            "error": message
        }
        await game_manager.send_message(match_id, error_msg)
        return
    logger.info(f"[move_stone] Move successful at ({x}, {y})")

    game_state = {
        "type": "game_update",
        "match_id": match_id,
        "board": game.board,
        "current_player": game.current_player,
        "black_player": game.black_player,
        "white_player": game.white_player,
        "game_over": game.game_over,
        "winner": game.winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"]
    }
    logger.info(f"[move_stone] Broadcasting game_update to match {match_id}")
    logger.info(f"[move_stone] Game state to broadcast: {game_state}")
    logger.info(f"[move_stone] Active connections for match: {game_manager.active_connections.get(match_id, [])}")

    connected_users = [game_manager.get_username_by_sid(s) for s in game_manager.active_connections.get(match_id, [])]
    logger.info(f"[move_stone] Connected users: {connected_users}")

    await game_manager.send_message(match_id, game_state)
    logger.info(f"[move_stone] Broadcast complete")

@sio.event
async def resign(sid, data):
    from backend.services.match_service import get_matches
    session = await sio.get_session(sid)
    username = session.get('username', 'anonymous')
    match_id = data.get("match_id")
    player_color = data.get("player")

    if not match_id or not player_color:
        logger.error(f"[resign] missing required fields in data={data}")
        return

    matches = get_matches()
    if match_id not in matches:
        logger.error(f"[resign] Match not found: {match_id}")
        return

    game = matches[match_id]
    if username not in (game.black_player, game.white_player):
        logger.info(f"[resign] {username} is not in match {match_id}")
        return

    if (player_color == "black" and username != game.black_player) or \
       (player_color == "white" and username != game.white_player):
        logger.info(f"[resign] {username} cannot resign color={player_color}")
        return

    if game.game_over:
        logger.info(f"[resign] Game {match_id} is already over.")
        return

    success, message = game.resign(player_color)
    if not success:
        logger.info(f"[resign] Resign failed: {message}")
        return
    game.update_timers()

    game_state = {
        "type": "game_update",
        "match_id": match_id,
        "board": game.board,
        "current_player": game.current_player,
        "game_over": game.game_over,
        "winner": game.winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"]
    }
    await game_manager.send_message(match_id, game_state)

    # 更新房间状态并广播给大厅
    from backend.routers.rooms import rooms, broadcast_update
    for room_id, room_info in rooms.items():
        if room_info.get("match_id") == match_id:
            room_info["started"] = False
            await broadcast_update(room_id)
            break

@sio.event
async def mark_dead_stone(sid, data):
    from backend.services.scoring import mark_dead_stone
    from backend.services.match_service import get_matches

    session = await sio.get_session(sid)
    username = session.get('username', 'anonymous')
    match_id = data.get("match_id")
    x = data.get("x")
    y = data.get("y")

    if match_id is None or x is None or y is None:
        logger.error(f"[mark_dead_stone] missing required fields. data={data}")
        return

    matches = get_matches()
    if match_id not in matches:
        logger.error(f"[mark_dead_stone] Match not found: {match_id}")
        return

    game = matches[match_id]
    if username not in (game.black_player, game.white_player):
        logger.info(f"[mark_dead_stone] {username} is not in match {match_id}")
        return

    if game.game_over:
        logger.info(f"[mark_dead_stone] Game {match_id} is already over.")
        return

    mark_dead_stone(game, x, y, game.current_player)
    scoring_data = {
        "dead_stones": list(game.dead_stones),
        "territory": [],
        "blackScore": 0,
        "whiteScore": 0,
    }
    game_state = {
        "type": "game_update",
        "match_id": match_id,
        "board": game.board,
        "current_player": game.current_player,
        "game_over": game.game_over,
        "winner": game.winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"],
        "scoring_data": scoring_data
    }
    await game_manager.send_message(match_id, game_state)

@sio.event
async def confirm_scoring(sid, data):
    from backend.services.scoring import final_scoring
    from backend.services.match_service import get_matches

    session = await sio.get_session(sid)
    username = session.get('username', 'anonymous')
    match_id = data.get("match_id")

    if not match_id:
        logger.error(f"[confirm_scoring] missing match_id in data={data}")
        return

    matches = get_matches()
    if match_id not in matches:
        logger.error(f"[confirm_scoring] Match not found: {match_id}")
        return

    game = matches[match_id]
    if username not in (game.black_player, game.white_player):
        logger.info(f"[confirm_scoring] {username} is not in match {match_id}")
        return

    black_score, white_score, winner = final_scoring(game)
    scoring_data = {
        "dead_stones": list(game.dead_stones),
        "territory": [],
        "blackScore": black_score,
        "whiteScore": white_score
    }
    game_state = {
        "type": "game_update",
        "match_id": match_id,
        "board": game.board,
        "current_player": game.current_player,
        "game_over": True,
        "winner": winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"],
        "scoring_data": scoring_data
    }
    await game_manager.send_message(match_id, game_state)

    # 更新房间状态并广播给大厅
    from backend.routers.rooms import rooms, broadcast_update
    for room_id, room_info in rooms.items():
        if room_info.get("match_id") == match_id:
            room_info["started"] = False
            await broadcast_update(room_id)
            break

@sio.event
async def update_status(sid, data):
    from backend.services.match_service import get_matches

    session = await sio.get_session(sid)
    username = session.get('username', 'anonymous')
    match_id = data.get("match_id")
    new_status = data.get("status")

    if not match_id or not new_status:
        logger.error(f"[update_status] missing fields. data={data}")
        return

    matches = get_matches()
    if match_id not in matches:
        logger.error(f"[update_status] Match not found: {match_id}")
        return

    game = matches[match_id]
    if username not in (game.black_player, game.white_player):
        logger.info(f"[update_status] {username} is not in match {match_id}")
        return

    game.status = new_status
    game_state = {
        "type": "game_update",
        "match_id": match_id,
        "board": game.board,
        "current_player": game.current_player,
        "game_over": game.game_over,
        "winner": game.winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"],
        "status": game.status
    }
    await game_manager.send_message(match_id, game_state)
