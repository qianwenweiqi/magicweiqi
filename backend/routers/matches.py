# backend/routers/matches.py

from fastapi import APIRouter, HTTPException
from backend.models import Move, CreateMatch, Player, Card, ResignRequest
from backend.services.go_game import GoGame
import uuid

router = APIRouter()

matches = {}  # match_id -> GoGame

# 改动：更真实一些的黑白用户名
dummy_players = [
    Player(player_id="AlphaGo", elo=3200, is_black=True, avatar_url=""),
    Player(player_id="Lee Sedol", elo=2800, is_black=False, avatar_url=""),
]

dummy_cards_black = [
    Card(card_id="card01", name="Attack Boost", description="Increases territory by 2", cost=1),
    Card(card_id="card02", name="Ko Trick", description="Retake Ko immediately", cost=2),
]

dummy_cards_white = [
    Card(card_id="card03", name="Solid Defense", description="Adds 1 to your liberties", cost=1),
    Card(card_id="card04", name="Lightning Strike", description="Removes 1 opponent stone", cost=1),
]

@router.post("/matches")
def create_match(data: CreateMatch):
    match_id = str(uuid.uuid4())
    game = GoGame(board_size=data.board_size)
    matches[match_id] = game
    return {
        "match_id": match_id,
        "board_size": data.board_size,
        "board": game.board,
        "current_player": game.current_player,
        "passes": game.passes,
        "captured": game.captured,
        "history_length": len(game.history),
        "game_over": game.game_over,
        "winner": game.winner,
    }

@router.post("/matches/{match_id}/move")
def make_move(match_id: str, move: Move):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    success, message = game.play_move(move.x, move.y)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {
        "board": game.board,
        "current_player": game.current_player,
        "message": message,
        "passes": game.passes,
        "captured": game.captured,
        "history_length": len(game.history),
        "game_over": game.game_over,
        "winner": game.winner,
    }

@router.post("/matches/{match_id}/resign")
def resign_match(match_id: str, req: ResignRequest):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    success, message = game.resign(req.player)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {
        "board": game.board,
        "winner": game.winner,
        "game_over": game.game_over,
        "message": message,
        "passes": game.passes,
        "captured": game.captured,
        "history_length": len(game.history),
    }

@router.get("/matches/{match_id}")
def get_match(match_id: str):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    return {
        "board": game.board,
        "current_player": game.current_player,
        "winner": game.winner,
        "game_over": game.game_over,
        "passes": game.passes,
        "captured": game.captured,
        "history_length": len(game.history),
    }

@router.get("/matches/{match_id}/players")
def get_match_players(match_id: str):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    return {
        "players": dummy_players,
        "black_cards": dummy_cards_black,
        "white_cards": dummy_cards_white,
    }

@router.get("/matches/{match_id}/export_sgf")
def export_sgf(match_id: str):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]

    black_player_name = "AlphaGo"
    white_player_name = "Lee Sedol"
    result = game.winner or "Draw"

    # 简易SGF示例
    sgf_content = f"(;GM[1]FF[4]SZ[{game.board_size}]PB[{black_player_name}]PW[{white_player_name}]RE[{result}])"
    return {"sgf": sgf_content}
