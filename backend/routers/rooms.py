from fastapi import APIRouter, HTTPException, Depends
from ..auth import get_current_user
import uuid
import time

router = APIRouter()

rooms = {}  # room_id -> { config..., players: [username], ready: {username: bool}, started: bool, timer: int }

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
            "timer": rinfo["timer"]
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
        "timer": time.time()  # Initialize timer with current timestamp
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
        # Create the game with player information
        from ..services.go_game import GoGame
        black_player = room["players"][0] if room["whoIsBlack"] == "creator" else room["players"][1]
        white_player = room["players"][1] if room["whoIsBlack"] == "creator" else room["players"][0]
        
        # Initialize game with proper player tracking
        game = GoGame(
            board_size=room["boardSize"],
            komi=6.5,
            black_player=black_player,
            white_player=white_player,
            players=[black_player, white_player]  # Explicitly track both players
        )
        
        # Initialize timers based on room settings
        game.timers = {
            "black": {
                "main_time": room["mainTime"],
                "byo_yomi": room["byoYomiTime"],
                "periods": room["byoYomiPeriods"],
                "last_update": time.time()
            },
            "white": {
                "main_time": room["mainTime"],
                "byo_yomi": room["byoYomiTime"],
                "periods": room["byoYomiPeriods"],
                "last_update": time.time()
            }
        }
        
        # Store the game in matches
        from .matches import matches
        match_id = str(uuid.uuid4())
        matches[match_id] = {
            "game": game,
            "players": room["players"],
            "start_time": time.time()
        }
        
        room["started"] = True
        return {"started": True, "match_id": match_id}
    return {"started": False}

@router.post("/rooms/{room_id}/cancel")
def cancel_room(room_id: str, current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[room_id]
    if username not in room["players"]:
        raise HTTPException(status_code=400, detail="You are not in the room")
    
    # Remove player from room
    room["players"].remove(username)
    del room["ready"][username]
    
    # If room is empty, remove it
    if len(room["players"]) == 0:
        del rooms[room_id]
    
    return {"cancelled": True}

@router.delete("/rooms/{room_id}")
def delete_room(room_id: str, current_user: dict = Depends(get_current_user)):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    
    # If room has no players, allow deletion by anyone
    if not room["players"]:
        del rooms[room_id]
        return {"deleted": True}
    
    # Only the creator can delete the room
    if current_user["username"] != room["players"][0]:
        raise HTTPException(status_code=403, detail="Only the room creator can delete the room")
    
    del rooms[room_id]
    return {"deleted": True}

@router.post("/rooms/{room_id}/debug-join")
def debug_join_room(room_id: str, current_user: dict = Depends(get_current_user)):
    """Debug endpoint to join as second player and start game immediately"""
    username = current_user["username"]
        
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[room_id]
    
    # Add test user as second player if not already present
    if username not in room["players"]:
        if len(room["players"]) >= 2:
            # Replace second player with test user
            room["players"][1] = username
            room["ready"][username] = True
        else:
            # Add current user as both players
            room["players"].append(username)
            room["ready"][username] = True
            if len(room["players"]) == 1:
                # Add same user as second player
                room["players"].append(username)
                room["ready"][username] = True
            
    # Mark both players as ready
    for player in room["players"]:
        room["ready"][player] = True
        
    # Start game using normal initialization flow
    from ..services.go_game import GoGame
    
    # Ensure there are exactly 2 players
    if len(room["players"]) != 2:
        raise HTTPException(
            status_code=400,
            detail="Cannot start game - need exactly 2 players"
        )
        
    black_player = room["players"][0] if room["whoIsBlack"] == "creator" else room["players"][1]
    white_player = room["players"][1] if room["whoIsBlack"] == "creator" else room["players"][0]
    
    game = GoGame(
        board_size=room["boardSize"],
        komi=6.5,
        black_player=black_player,
        white_player=white_player
    )
    
    # Initialize timers based on room settings
    game.timers = {
        "black": {
            "main_time": room["mainTime"],
            "byo_yomi": room["byoYomiTime"],
            "periods": room["byoYomiPeriods"],
            "last_update": time.time()
        },
        "white": {
            "main_time": room["mainTime"],
            "byo_yomi": room["byoYomiTime"],
            "periods": room["byoYomiPeriods"],
            "last_update": time.time()
        }
    }
    
    # Store the game in matches
    from .matches import matches
    match_id = str(uuid.uuid4())
    matches[match_id] = {
        "game": game,
        "players": room["players"],
        "start_time": time.time()
    }
    
    room["started"] = True
    return {"started": True, "match_id": match_id}
