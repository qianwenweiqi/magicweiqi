# backend/routers/rooms.py
from fastapi import APIRouter, HTTPException, Depends
from ..auth import get_current_user
import uuid

router = APIRouter()

rooms = {}  # room_id -> { config..., players: [username], ready: {username: bool}, started: bool }

@router.get("/rooms")
def list_rooms():
    room_list = []
    for rid, rinfo in rooms.items():
        room_list.append({
            "room_id": rid,
            "eloMin": rinfo["eloMin"],
            "eloMax": rinfo["eloMax"],
            "players": rinfo["players"],
            "started": rinfo["started"],
        })
    return {"rooms": room_list}

@router.post("/rooms")
def create_room(data: dict, current_user: dict = Depends(get_current_user)):
    """
    data={
      "eloMin": int,
      "eloMax": int,
      "whoIsBlack": "creator"/"opponent"/"random",
      "timeRule": "absolute"/"byoyomi",
      "mainTime": 300,
      "byoYomiPeriods":3,
      "byoYomiTime":30,
      "boardSize":19,
      "handicap":0
    }
    """
    room_id = str(uuid.uuid4())
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
        "players": [],
        "ready": {},
        "started": False,
    }
    return {"room_id": room_id}

@router.post("/rooms/{room_id}/join")
def join_room(room_id: str, current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[room_id]
    if room["started"]:
        raise HTTPException(status_code=400, detail="Room has started")

    if len(room["players"]) >= 2:
        raise HTTPException(status_code=400, detail="Room is full")

    if username in room["players"]:
        return {"joined": True}

    room["players"].append(username)
    room["ready"][username] = False
    return {"joined": True}

@router.post("/rooms/{room_id}/ready")
def ready_room(room_id: str, current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[room_id]
    if username not in room["players"]:
        raise HTTPException(status_code=400, detail="You are not in the room")

    room["ready"][username] = True
    all_ready = all(v for v in room["ready"].values())
    if len(room["players"]) == 2 and all_ready and not room["started"]:
        # 在此创建真正的 match 并开始游戏
        room["started"] = True
        # 省略: createMatch logic
        return {"started": True, "match_id": "some-new-match-id"}
    return {"started": False}
