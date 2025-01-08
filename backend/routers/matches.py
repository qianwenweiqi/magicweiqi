from fastapi import APIRouter, HTTPException
from backend.models import Move, CreateMatch, Player, Card, ResignRequest
from backend.services.go_game import GoGame
import uuid

router = APIRouter()

matches = {}  # match_id -> GoGame

# Dummy玩家数据：可换成从 DynamoDB 获取
dummy_players = [
    Player(player_id="userA", elo=2000, is_black=True,
           avatar_url="https://via.placeholder.com/80/0000FF/808080?text=UserA"),
    Player(player_id="userB", elo=1850, is_black=False,
           avatar_url="https://via.placeholder.com/80/FF0000/808080?text=UserB")
]

# Dummy卡牌数据：可换成从 DynamoDB 或别的数据库获取
dummy_cards_black = [
    Card(card_id="card01", name="Attack Boost", description="Increases territory by 2", cost=1),
    Card(card_id="card02", name="Ko Trick", description="Let you retake Ko immediately", cost=2),
]

dummy_cards_white = [
    Card(card_id="card03", name="Solid Defense", description="Adds 1 to your liberties", cost=1),
    Card(card_id="card04", name="Lightning Strike", description="Removes 1 opponent stone", cost=3),
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
        "message": message
    }

@router.post("/matches/{match_id}/resign")
def resign_match(match_id: str, req: ResignRequest):
    """前端 JSON: { "player": "black" or "white" }"""
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    success, message = game.resign(req.player)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {
        "board": game.board,
        "winner": game.winner,
        "message": message
    }

@router.get("/matches/{match_id}")
def get_match(match_id: str):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    return {
        "board": game.board,
        "current_player": game.current_player,
        "winner": game.winner
    }

@router.get("/players")
def get_players():
    """获取本对局玩家和卡牌信息。可改成按 match_id 区分。"""
    return {
        "players": dummy_players,
        "black_cards": dummy_cards_black,
        "white_cards": dummy_cards_white
    }
