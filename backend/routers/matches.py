# backend/routers/matches.py
from fastapi import APIRouter, HTTPException, File, UploadFile, Depends
from backend.auth import get_current_user
from backend.models import Move, CreateMatch, Player, Card, ResignRequest
from backend.services.go_game import GoGame
from backend.services.scoring import mark_dead_stone, final_scoring
import uuid
import logging
from sgfmill import sgf

logger = logging.getLogger(__name__)

router = APIRouter()

from backend.services.match_service import get_matches, create_match_internal

@router.post("/matches")
def create_match(data: CreateMatch):
    if data.black_player == data.white_player:
        raise HTTPException(status_code=400, detail="Black and white players cannot be the same")
    
    result = create_match_internal(data)
    matches = get_matches()
    logger.info(f"Created new match with id: {result['match_id']}")
    logger.info(f"Current matches: {list(matches.keys())}")
    return result

@router.post("/matches/{match_id}/move")
async def make_move(match_id: str, move: Move, current_user: dict = Depends(get_current_user)):
    matches = get_matches()
    if match_id not in matches:
        logger.error(f"Match not found: {match_id}")
        logger.info(f"Current matches: {list(matches.keys())}")
        raise HTTPException(status_code=404, detail="Match not found")
    
    game = matches[match_id]
    logger.info(f"Accessed match: {match_id}")
    
    # Verify it's the player's turn
    username = current_user["username"]
    if (game.current_player == "black" and username != game.black_player) or \
       (game.current_player == "white" and username != game.white_player):
        raise HTTPException(status_code=403, detail="Not your turn")
    
    if game.game_over:
        raise HTTPException(status_code=400, detail="Game is already over.")

    success, message = game.play_move(move.x, move.y)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Broadcast game update to all connected clients
    from backend.main import game_manager
    game_state = {
        "type": "game_update",
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
    await game_manager.send_message(match_id, game_state)
    
    return {
        "board": game.board,
        "current_player": game.current_player,
        "message": message,
        "passes": game.passes,
        "captured": game.captured,
        "history_length": len(game.history),
        "game_over": game.game_over,
        "winner": game.winner,
        "black_timer": {
            "main_time": game.timers["black"]["main_time"],
            "byo_yomi": game.timers["black"]["byo_yomi"],
            "periods": game.timers["black"]["periods"]
        },
        "white_timer": {
            "main_time": game.timers["white"]["main_time"],
            "byo_yomi": game.timers["white"]["byo_yomi"],
            "periods": game.timers["white"]["periods"]
        }
    }

@router.post("/matches/{match_id}/resign")
async def resign_match(match_id: str, req: ResignRequest, current_user: dict = Depends(get_current_user)):
    matches = get_matches()
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    
    game = matches[match_id]
    
    # Verify it's a player in the game
    username = current_user["username"]
    if username != game.black_player and username != game.white_player:
        raise HTTPException(status_code=403, detail="Only players can resign")
    
    # Verify player is resigning their own color
    if (req.player == "black" and username != game.black_player) or \
       (req.player == "white" and username != game.white_player):
        raise HTTPException(status_code=403, detail="Can only resign your own color")
    
    success, message = game.resign(req.player)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    game.update_timers()
    
    # Broadcast game update
    from backend.main import game_manager
    await game_manager.send_message(match_id, {
        "type": "game_update",
        "board": game.board,
        "current_player": game.current_player,
        "game_over": game.game_over,
        "winner": game.winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"]
    })
    
    return {
        "board": game.board,
        "winner": game.winner,
        "game_over": game.game_over,
        "message": message,
        "passes": game.passes,
        "captured": game.captured,
        "history_length": len(game.history),
        "black_timer": {
            "main_time": game.timers["black"]["main_time"],
            "byo_yomi": game.timers["black"]["byo_yomi"],
            "periods": game.timers["black"]["periods"]
        },
        "white_timer": {
            "main_time": game.timers["white"]["main_time"],
            "byo_yomi": game.timers["white"]["byo_yomi"],
            "periods": game.timers["white"]["periods"]
        }
    }

@router.get("/matches/{match_id}")
def get_match(match_id: str):
    matches = get_matches()
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    game.update_timers()
    return {
        "board": game.board,
        "current_player": game.current_player,
        "winner": game.winner,
        "game_over": game.game_over,
        "passes": game.passes,
        "captured": game.captured,
        "history_length": len(game.history),
        "black_timer": {
            "main_time": game.timers["black"]["main_time"],
            "byo_yomi": game.timers["black"]["byo_yomi"],
            "periods": game.timers["black"]["periods"]
        },
        "white_timer": {
            "main_time": game.timers["white"]["main_time"],
            "byo_yomi": game.timers["white"]["byo_yomi"],
            "periods": game.timers["white"]["periods"]
        }
    }

@router.get("/matches/{match_id}/players")
def get_match_players(match_id: str):
    matches = get_matches()
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    return {
        "players": [
            Player(
                player_id=game.black_player,
                elo=0,  # TODO
                is_black=True,
                avatar_url=""
            ),
            Player(
                player_id=game.white_player,
                elo=0,  # TODO
                is_black=False,
                avatar_url=""
            )
        ],
        "black_cards": [],  # TODO: Implement card system
        "white_cards": [],  # TODO: Implement card system
    }

@router.post("/matches/{match_id}/mark_dead_stone")
async def mark_dead_stone_api(match_id: str, xy: dict, current_user: dict = Depends(get_current_user)):
    matches = get_matches()
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    
    game = matches[match_id]
    
    # Verify it's a player in the game
    username = current_user["username"]
    if username != game.black_player and username != game.white_player:
        raise HTTPException(status_code=403, detail="Only players can mark dead stones")
    
    x = xy["x"]
    y = xy["y"]
    mark_dead_stone(game, x, y, game.current_player)
    scoring_data = {
        "dead_stones": list(game.dead_stones),
        "territory": [],
        "blackScore": 0,
        "whiteScore": 0,
    }

    # Broadcast scoring update
    from backend.main import game_manager
    await game_manager.send_message(match_id, {
        "type": "game_update",
        "board": game.board,
        "current_player": game.current_player,
        "game_over": game.game_over,
        "winner": game.winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"],
        "scoring_data": scoring_data
    })

    return {"scoring_data": scoring_data}

@router.post("/matches/{match_id}/confirm_scoring")
async def confirm_scoring_api(match_id: str, current_user: dict = Depends(get_current_user)):
    matches = get_matches()
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    
    # Verify it's a player in the game
    username = current_user["username"]
    if username != game.black_player and username != game.white_player:
        raise HTTPException(status_code=403, detail="Only players can confirm scoring")
    
    black_score, white_score, winner = final_scoring(game)

    # Broadcast final scoring
    from backend.main import game_manager
    await game_manager.send_message(match_id, {
        "type": "game_update",
        "board": game.board,
        "current_player": game.current_player,
        "game_over": True,
        "winner": winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"],
        "scoring_data": {
            "dead_stones": list(game.dead_stones),
            "territory": [],
            "blackScore": black_score,
            "whiteScore": white_score,
        }
    })

    return {
        "final_scored": True,
        "black_score": black_score,
        "white_score": white_score,
        "winner": winner,
    }

@router.post("/matches/{match_id}/update_status")
async def update_match_status(match_id: str, status: dict, current_user: dict = Depends(get_current_user)):
    matches = get_matches()
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    
    game = matches[match_id]
    
    # Verify it's a player in the game
    username = current_user["username"]
    if username != game.black_player and username != game.white_player:
        raise HTTPException(status_code=403, detail="Only players can update match status")
    
    # Update game status
    game.status = status["status"]
    
    # Broadcast status update
    from backend.main import game_manager
    await game_manager.send_message(match_id, {
        "type": "game_update",
        "board": game.board,
        "current_player": game.current_player,
        "game_over": game.game_over,
        "winner": game.winner,
        "captured": game.captured,
        "black_timer": game.timers["black"],
        "white_timer": game.timers["white"],
        "status": game.status
    })
    
    return {"updated": True}

@router.get("/matches/{match_id}/export_sgf")
def export_sgf(match_id: str):
    """
    x=0 在底行, SGF row=0 在顶行 => row=(board_size-1 - x)
    col=y
    """
    matches = get_matches()
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    sz = game.board_size

    sgf_game = sgf.Sgf_game(size=sz)
    root_node = sgf_game.get_root()
    root_node.set("PB", "BlackPlayer")
    root_node.set("PW", "WhitePlayer")

    for (color, x, y) in game.move_records:
        row = sz - 1 - x
        col = y
        c = "b" if color == "black" else "w"
        node = sgf_game.extend_main_sequence()
        node.set_move(c, (row, col))

    return {"sgf": sgf_game.serialise().decode("utf-8")}


@router.post("/review_sgf")
def review_sgf(file: UploadFile = File(...)):
    """
    将SGF解析成序列化落子列表： (color, x, y)
    """
    try:
        content = file.file.read()
        sgf_game = sgf.Sgf_game.from_bytes(content)
        size = sgf_game.get_size()
        moves = []
        for node in sgf_game.get_main_sequence():
            color, move = node.get_move()
            if color and move:
                row, col = move
                x = size - 1 - row
                y = col
                stone_color = "black" if color == "b" else "white"
                moves.append({"color": stone_color, "x": x, "y": y})
        return {"moves": moves}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse SGF: {str(e)}")
