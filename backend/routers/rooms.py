# backend/routers/rooms.py

from fastapi import APIRouter, HTTPException, Depends
from backend.auth import get_current_user
import uuid
import time
import random
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

rooms = {}  # room_id -> { players:[], ready:{}, started:bool, match_id:str, ... }

async def broadcast_update(room_id: str = None):
    """
    广播:
      1) 给lobby => type='lobby_update' + 所有rooms
      2) 若room_id => 给此房间 => type='room_update'
    """
    from backend.main import sio
    from backend.services.websocket_manager import room_manager

    try:
        # 1) 整理rooms列表 => 发给lobby
        room_list = []
        for rid, rinfo in rooms.items():
            players_info = [{"username": p, "elo":1500} for p in rinfo["players"]]
            age = time.time() - rinfo["timer"]
            # 获取游戏状态
            game_over = False
            winner = None
            if rinfo.get("match_id"):
                from backend.services.match_service import matches
                if rinfo["match_id"] in matches:
                    game = matches[rinfo["match_id"]]["game"]
                    game_over = game.game_over
                    winner = game.winner

            room_data = {
                "room_id": rid,
                "eloMin": rinfo["eloMin"],
                "eloMax": rinfo["eloMax"],
                "players": players_info,
                "started": rinfo["started"],
                "game_over": game_over,
                "winner": winner,
                "age": int(age),
                "match_id": rinfo.get("match_id"),
                "timeRule": rinfo["timeRule"],
                "mainTime": rinfo["mainTime"],
                "byoYomiPeriods": rinfo["byoYomiPeriods"],
                "byoYomiTime": rinfo["byoYomiTime"],
                "whoIsBlack": rinfo["whoIsBlack"],
                "ready": rinfo["ready"],
                "deleting": rinfo.get("deleting", False),
                "lastUpdateTime": int(time.time())
            }
            room_list.append(room_data)

        lobby_update = {
            "type": "lobby_update",
            "rooms": room_list,
            "lastUpdateTime": int(time.time())
        }
        await sio.emit("lobby_update", lobby_update, room='lobby')

        # 2) 如果指定room_id, 给该房间发 room_update
        if room_id and room_id in rooms:
            r = rooms[room_id]
            players_info = [{"username": p, "elo":1500} for p in r["players"]]
            single_data = {
                "room_id": room_id,
                "eloMin": r["eloMin"],
                "eloMax": r["eloMax"],
                "players": players_info,
                "started": r["started"],
                "timer": r["timer"],
                "match_id": r.get("match_id"),
                "timeRule": r["timeRule"],
                "mainTime": r["mainTime"],
                "byoYomiPeriods": r["byoYomiPeriods"],
                "byoYomiTime": r["byoYomiTime"],
                "whoIsBlack": r["whoIsBlack"],
                "ready": r["ready"],
                "deleting": r.get("deleting", False),
                "lastUpdateTime": int(time.time())
            }
            room_update_msg = {
                "type": "room_update",
                "room_id": room_id,
                "data": single_data
            }
            await sio.emit("room_update", room_update_msg, room=room_id)
    except Exception as e:
        logger.error(f"Error in broadcast_update: {str(e)}")


from pydantic import BaseModel

class RoomConfig(BaseModel):
    eloMin: int
    eloMax: int
    whoIsBlack: str
    timeRule: str
    mainTime: int
    byoYomiPeriods: int
    byoYomiTime: int
    boardSize: int
    handicap: int

@router.get("/rooms")
async def list_rooms():
    """
    Http接口: 返回rooms
    """
    try:
        room_list = []
        for rid, rinfo in rooms.items():
            players_info = [{"username": p, "elo":1500} for p in rinfo["players"]]
            age = time.time() - rinfo["timer"]
            # 获取游戏状态
            game_over = False
            winner = None
            if rinfo.get("match_id"):
                from backend.services.match_service import matches
                if rinfo["match_id"] in matches:
                    game = matches[rinfo["match_id"]]["game"]
                    game_over = game.game_over
                    winner = game.winner

            room_list.append({
                "room_id": rid,
                "eloMin": rinfo["eloMin"],
                "eloMax": rinfo["eloMax"],
                "players": players_info,
                "started": rinfo["started"],
                "game_over": game_over,
                "winner": winner,
                "age": int(age),
                "match_id": rinfo.get("match_id"),
                "timeRule": rinfo["timeRule"],
                "mainTime": rinfo["mainTime"],
                "byoYomiPeriods": rinfo["byoYomiPeriods"],
                "byoYomiTime": rinfo["byoYomiTime"],
                "whoIsBlack": rinfo["whoIsBlack"],
                "ready": rinfo["ready"]
            })
        return {"rooms": room_list}
    except Exception as e:
        logger.error(f"Error listing rooms: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list rooms")

@router.post("/rooms")
async def create_room(config: RoomConfig, current_user: dict = Depends(get_current_user)):
    """
    创建房间
    """
    try:
        data = config.dict()
        logger.info(f"Creating room with config: {data}")
        room_id = str(uuid.uuid4())
        username = current_user["username"]

        for rid, rinfo in rooms.items():
            if not rinfo["started"]:
                if username in rinfo["players"]:
                    raise HTTPException(status_code=400, detail="Already in another room")

        rooms[room_id] = {
            "eloMin": data["eloMin"],
            "eloMax": data["eloMax"],
            "whoIsBlack": data["whoIsBlack"],
            "timeRule": data["timeRule"],
            "mainTime": data["mainTime"],
            "byoYomiPeriods": data["byoYomiPeriods"],
            "byoYomiTime": data["byoYomiTime"],
            "boardSize": data["boardSize"],
            "handicap": data["handicap"],
            "players": [username],
            "ready": {username: False},
            "started": False,
            "timer": time.time(),
            "match_id": None
        }

        await broadcast_update(room_id)
        logger.info(f"Room {room_id} created successfully")
        return {"room_id": room_id}
    except Exception as e:
        logger.error(f"Error creating room: {str(e)}")
        raise

@router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, current_user: dict = Depends(get_current_user)):
    try:
        username = current_user["username"]
        if room_id not in rooms:
            raise HTTPException(status_code=404, detail="Room not found")
        room = rooms[room_id]

        for rid, rinfo in rooms.items():
            if rid != room_id and username in rinfo["players"] and not rinfo["started"]:
                raise HTTPException(status_code=400, detail="Already in another room")

        if room["started"]:
            raise HTTPException(status_code=400, detail="Room has started")
        if len(room["players"]) >= 2:
            raise HTTPException(status_code=400, detail="Room is full")

        if username not in room["players"]:
            room["players"].append(username)
            room["ready"][username] = False

        await broadcast_update(room_id)
        logger.info(f"User {username} joined room {room_id} successfully")
        return {"joined": True}
    except Exception as e:
        logger.error(f"Error joining room {room_id}: {str(e)}")
        raise

@router.post("/rooms/{room_id}/ready")
async def ready_room(room_id: str, current_user: dict = Depends(get_current_user)):
    try:
        username = current_user["username"]
        if room_id not in rooms:
            raise HTTPException(status_code=404, detail="Room not found")
        room = rooms[room_id]
        if username not in room["players"]:
            raise HTTPException(status_code=400, detail="You are not in the room")
        if room["started"]:
            raise HTTPException(status_code=400, detail="Game already started")

        room["ready"][username] = True
        await broadcast_update(room_id)

        all_ready = all(v for v in room["ready"].values())
        if len(room["players"])==2 and all_ready:
            if room["match_id"]:
                return {"started": True, "match_id": room["match_id"]}
            if not room["started"]:
                try:
                    from backend.services.match_service import create_match_internal
                    from backend.models import CreateMatch
                    if room["whoIsBlack"]=="creator":
                        black_player = room["players"][0]
                        white_player = room["players"][1]
                    elif room["whoIsBlack"]=="opponent":
                        black_player = room["players"][1]
                        white_player = room["players"][0]
                    else:
                        black_player = random.choice(room["players"])
                        white_player = (room["players"][1] if black_player==room["players"][0]
                                        else room["players"][0])

                    match_data = CreateMatch(
                        board_size=room["boardSize"],
                        black_player=black_player,
                        white_player=white_player,
                        main_time=room["mainTime"],
                        byo_yomi_time=room["byoYomiTime"],
                        byo_yomi_periods=room["byoYomiPeriods"],
                        komi=6.5,
                        handicap=0
                    )
                    resp = create_match_internal(match_data)
                    room["started"] = True
                    room["match_id"] = resp["match_id"]

                    await broadcast_update(room_id)
                    return {"started": True, "match_id": resp["match_id"]}
                except Exception as e:
                    logger.error(f"Error creating match for room {room_id}: {str(e)}")
                    raise HTTPException(status_code=500, detail="Failed to create match")

        return {"started": False}
    except Exception as e:
        logger.error(f"Error readying in room {room_id}: {str(e)}")
        raise

@router.post("/rooms/{room_id}/cancel")
async def cancel_room(room_id: str, current_user: dict = Depends(get_current_user)):
    try:
        username = current_user["username"]
        if room_id not in rooms:
            raise HTTPException(status_code=404, detail="Room not found")
        room = rooms[room_id]
        if username not in room["players"]:
            raise HTTPException(status_code=400, detail="You are not in the room")
        if room["started"]:
            raise HTTPException(status_code=400, detail="Cannot cancel - game started")

        room["players"].remove(username)
        del room["ready"][username]
        if len(room["players"])==0:
            del rooms[room_id]
        else:
            await broadcast_update(room_id)
        return {"cancelled": True}
    except Exception as e:
        logger.error(f"Error canceling room {room_id}: {str(e)}")
        raise

@router.get("/rooms/current")
async def get_current_room(current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    logger.info(f"Checking current room for user {username}")
    for rid, rinfo in rooms.items():
        if username in rinfo["players"]:
            logger.info(f"Found user {username} in room {rid}")
            return {"room_id": rid}
    logger.info(f"No room found for user {username}")
    # 直接抛 404
    raise HTTPException(status_code=404, detail="Not in any room")

@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, current_user: dict = Depends(get_current_user)):
    try:
        username = current_user["username"]
        if room_id not in rooms:
            raise HTTPException(status_code=404, detail="Room not found")
        room = rooms[room_id]
        # 检查游戏是否结束
        game_over = False
        if room.get("match_id"):
            from backend.services.match_service import matches
            if room["match_id"] in matches:
                game = matches[room["match_id"]]["game"]
                game_over = game.game_over

        # 只有未开始或已结束的游戏可以删除
        if room["started"] and not game_over:
            raise HTTPException(status_code=400, detail="Cannot delete - game in progress")
        if not room["players"]:
            del rooms[room_id]
            await broadcast_update()
            return {"deleted": True}
        if username != room["players"][0]:
            raise HTTPException(status_code=403, detail="Only the creator can delete the room")
        room["deleting"] = True
        await broadcast_update(room_id)
        del rooms[room_id]
        return {"deleted": True}
    except Exception as e:
        logger.error(f"Error deleting room {room_id}: {str(e)}")
        raise
