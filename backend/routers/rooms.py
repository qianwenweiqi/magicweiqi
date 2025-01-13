# backend/routers/rooms.py
from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket
from backend.auth import get_current_user
import uuid
import time
import random
import json

router = APIRouter()

rooms = {}  # room_id -> { config..., players: [username], ready: {username: bool}, started: bool, timer: int, match_id: str }

@router.get("/rooms")
async def list_rooms():
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("Listing all active rooms")
        room_list = []
        
        for rid, rinfo in rooms.items():
            # Get detailed player info
            players = [get_player_info(p) for p in rinfo["players"]]
            
            # Calculate room age
            age = time.time() - rinfo["timer"]
            
            room_list.append({
                "room_id": rid,
                "eloMin": rinfo["eloMin"],
                "eloMax": rinfo["eloMax"],
                "players": players,  # Now includes player ELO
                "started": rinfo["started"],
                "age": int(age),  # Room age in seconds
                "match_id": rinfo.get("match_id"),
                "timeRule": rinfo["timeRule"],
                "mainTime": rinfo["mainTime"],
                "byoYomiPeriods": rinfo["byoYomiPeriods"],
                "byoYomiTime": rinfo["byoYomiTime"],
                "whoIsBlack": rinfo["whoIsBlack"],
                "ready": rinfo["ready"]  # Show ready status
            })
        
        logger.info(f"Found {len(room_list)} active rooms")
        return {"rooms": room_list}
    except Exception as e:
        logger.error(f"Error listing rooms: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list rooms")

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

@router.post("/rooms")
async def create_room(config: RoomConfig, current_user: dict = Depends(get_current_user)):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        data = config.dict()
        logger.info(f"Creating room with config: {data}")
        
        room_id = str(uuid.uuid4())
        username = current_user["username"]
        
        # Validate user isn't already in another room
        for rid, room in rooms.items():
            if username in room["players"] and not room["started"]:
                logger.warning(f"User {username} already in room {rid}")
                raise HTTPException(status_code=400, detail="Already in another room")
        
        logger.info(f"Creating room {room_id} for user {username}")
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
            "players": [username],  # 创建者
            "ready": {username: False},
            "started": False,
            "timer": time.time(),
            "match_id": None
        }

        # Send update before returning to ensure clients are notified
        await send_room_update(room_id)
        logger.info(f"Room {room_id} created successfully")
        
        return {"room_id": room_id}
    except Exception as e:
        logger.error(f"Error creating room: {str(e)}")
        if room_id in rooms:
            del rooms[room_id]  # Clean up on error
        raise

def get_player_info(username: str):
    # Mock
    return {
        "username": username,
        "elo": 1500
    }

async def send_room_update(room_id: str, target_websocket: WebSocket = None):
    """
    Send a room update to either a specific WebSocket connection or broadcast to all connections.
    If target_websocket is provided, send only to that connection.
    Otherwise, broadcast to all connections in the room.
    """
    from backend.services.match_service import get_matches
    from backend.main import room_manager
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        if room_id not in rooms:
            logger.warning(f"Room {room_id} not found")
            return
            
        room = rooms[room_id]
        age = time.time() - room["timer"]
        
        update = {
            "type": "room_update",
            "players": [get_player_info(p) for p in room["players"]],
            "ready": room["ready"],
            "started": room["started"],
            "match_id": room.get("match_id"),
            "age": int(age),
            "eloMin": room["eloMin"],
            "eloMax": room["eloMax"],
            "timeRule": room["timeRule"],
            "mainTime": room["mainTime"],
            "byoYomiPeriods": room["byoYomiPeriods"],
            "byoYomiTime": room["byoYomiTime"],
            "whoIsBlack": room["whoIsBlack"],
            "deleting": room.get("deleting", False)
        }
        
        if target_websocket:
            logger.info(f"Sending room update to specific client in room {room_id}")
            await room_manager.send_message(room_id, update, target_websocket=target_websocket)
            logger.info(f"Room update sent to specific client in room {room_id}")
        else:
            logger.info(f"Broadcasting room update to all clients in room {room_id}")
            await room_manager.send_message(room_id, update)
            logger.info(f"Room update broadcast complete for room {room_id}")
            
    except Exception as e:
        logger.error(f"Error sending room update for room {room_id}: {str(e)}")

@router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, current_user: dict = Depends(get_current_user)):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        username = current_user["username"]
        logger.info(f"User {username} attempting to join room {room_id}")
        
        if room_id not in rooms:
            logger.warning(f"Room {room_id} not found")
            raise HTTPException(status_code=404, detail="Room not found")
        
        room = rooms[room_id]
        
        # Validate user isn't already in another room
        for rid, r in rooms.items():
            if rid != room_id and username in r["players"] and not r["started"]:
                logger.warning(f"User {username} already in room {rid}")
                raise HTTPException(status_code=400, detail="Already in another room")
        
        if room["started"]:
            logger.warning(f"Room {room_id} has already started")
            raise HTTPException(status_code=400, detail="Room has started")
            
        if len(room["players"]) >= 2:
            logger.warning(f"Room {room_id} is full")
            raise HTTPException(status_code=400, detail="Room is full")

        if username in room["players"]:
            logger.info(f"User {username} already in room {room_id}")
            return {"joined": True}

        logger.info(f"Adding user {username} to room {room_id}")
        room["players"].append(username)
        room["ready"][username] = False
        
        # Send update before returning to ensure clients are notified
        await send_room_update(room_id)
        logger.info(f"User {username} successfully joined room {room_id}")
        
        return {"joined": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining room {room_id}: {str(e)}")
        # Clean up if we partially added the user
        if room_id in rooms and username in rooms[room_id]["players"]:
            rooms[room_id]["players"].remove(username)
            if username in rooms[room_id]["ready"]:
                del rooms[room_id]["ready"][username]
            await send_room_update(room_id)
        raise HTTPException(status_code=500, detail="Failed to join room")

@router.post("/rooms/{room_id}/ready")
async def ready_room(room_id: str, current_user: dict = Depends(get_current_user)):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        username = current_user["username"]
        logger.info(f"User {username} attempting to mark ready in room {room_id}")
        
        if room_id not in rooms:
            logger.warning(f"Room {room_id} not found")
            raise HTTPException(status_code=404, detail="Room not found")
        
        room = rooms[room_id]
        if username not in room["players"]:
            logger.warning(f"User {username} not in room {room_id}")
            raise HTTPException(status_code=400, detail="You are not in the room")
        
        if room["started"]:
            logger.warning(f"Cannot mark ready in room {room_id} - game already started")
            raise HTTPException(status_code=400, detail="Cannot mark ready - game already started")
        
        logger.info(f"Marking user {username} as ready in room {room_id}")
        room["ready"][username] = True
        
        # Send update after marking ready
        await send_room_update(room_id)
        logger.info(f"User {username} marked ready in room {room_id}")

        all_ready = all(v for v in room["ready"].values())
        if len(room["players"]) == 2 and all_ready:
            # If match already exists, return it
            if room["match_id"]:
                logger.info(f"Room {room_id} already has match {room['match_id']}")
                return {"started": True, "match_id": room["match_id"]}
            
            # Only create new match if not already started
            if not room["started"]:
                try:
                    from backend.services.match_service import get_matches
                    logger.info(f"Creating new match for room {room_id}")

                    # Determine black and white players
                    if room["whoIsBlack"] == "creator":
                        black_player = room["players"][0]
                        white_player = room["players"][1]
                    elif room["whoIsBlack"] == "opponent":
                        black_player = room["players"][1]
                        white_player = room["players"][0]
                    else:  # random
                        black_player = random.choice(room["players"])
                        white_player = room["players"][1] if black_player == room["players"][0] else room["players"][0]
                    
                    logger.info(f"Black player: {black_player}, White player: {white_player}")

                    from backend.models import CreateMatch
                    from backend.services.match_service import create_match_internal

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

                    match_response = create_match_internal(match_data)
                    match_id = match_response["match_id"]
                    logger.info(f"Created match {match_id} for room {room_id}")
                    
                    room["started"] = True
                    room["match_id"] = match_id

                    # Send update before returning to ensure clients are notified
                    await send_room_update(room_id)
                    logger.info(f"Room {room_id} update sent with new match {match_id}")
                    
                    return {"started": True, "match_id": match_id}
                except Exception as e:
                    logger.error(f"Error creating match for room {room_id}: {str(e)}")
                    # Reset ready state on error
                    room["ready"] = {player: False for player in room["players"]}
                    await send_room_update(room_id)
                    raise HTTPException(status_code=500, detail="Failed to create match")

        return {"started": False}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking ready in room {room_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to mark ready")

@router.post("/rooms/{room_id}/cancel")
async def cancel_room(room_id: str, current_user: dict = Depends(get_current_user)):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        username = current_user["username"]
        logger.info(f"User {username} attempting to cancel room {room_id}")
        
        if room_id not in rooms:
            logger.warning(f"Room {room_id} not found")
            raise HTTPException(status_code=404, detail="Room not found")
        
        room = rooms[room_id]
        if username not in room["players"]:
            logger.warning(f"User {username} not in room {room_id}")
            raise HTTPException(status_code=400, detail="You are not in the room")
        
        if room["started"]:
            logger.warning(f"Cannot cancel room {room_id} - game already started")
            raise HTTPException(status_code=400, detail="Cannot cancel - game already started")
        
        logger.info(f"Removing user {username} from room {room_id}")
        room["players"].remove(username)
        del room["ready"][username]
        
        # Send update before cleanup to ensure clients are notified
        await send_room_update(room_id)
        logger.info(f"User {username} successfully removed from room {room_id}")
        
        # Clean up empty room
        if len(room["players"]) == 0:
            logger.info(f"Room {room_id} is empty, deleting")
            del rooms[room_id]
        
        return {"cancelled": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error canceling room {room_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cancel room")

@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, current_user: dict = Depends(get_current_user)):
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        username = current_user["username"]
        logger.info(f"User {username} attempting to delete room {room_id}")
        
        if room_id not in rooms:
            logger.warning(f"Room {room_id} not found")
            raise HTTPException(status_code=404, detail="Room not found")
        
        room = rooms[room_id]
        if room["started"]:
            logger.warning(f"Cannot delete room {room_id} - game already started")
            raise HTTPException(status_code=400, detail="Cannot delete - game already started")
        
        if not room["players"]:
            logger.info(f"Room {room_id} is empty, deleting")
            del rooms[room_id]
            return {"deleted": True}
        
        if username != room["players"][0]:
            logger.warning(f"User {username} is not the creator of room {room_id}")
            raise HTTPException(status_code=403, detail="Only the creator can delete the room")
        
        # Send final update before deletion
        room["deleting"] = True
        await send_room_update(room_id)
        logger.info(f"Sent final update for room {room_id}")
        
        # Delete the room
        del rooms[room_id]
        logger.info(f"Room {room_id} deleted successfully")
        
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting room {room_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete room")
