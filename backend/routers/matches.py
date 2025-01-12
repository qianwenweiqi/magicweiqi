# backend/routers/matches.py
from fastapi import APIRouter, HTTPException, File, UploadFile
from backend.models import Move, CreateMatch, Player, Card, ResignRequest
from backend.services.go_game import GoGame
from backend.services.scoring import mark_dead_stone, final_scoring
import uuid
from sgfmill import sgf

router = APIRouter()

matches = {}  # match_id -> GoGame

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
    if game.game_over:
        raise HTTPException(status_code=400, detail="Game is already over.")

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


@router.post("/matches/{match_id}/mark_dead_stone")
def mark_dead_stone_api(match_id: str, xy: dict):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    x = xy["x"]
    y = xy["y"]
    mark_dead_stone(game, x, y, game.current_player)
    scoring_data = {
        "dead_stones": list(game.dead_stones),
        "territory": [],
        "blackScore": 0,
        "whiteScore": 0,
    }
    return {"scoring_data": scoring_data}


@router.post("/matches/{match_id}/confirm_scoring")
def confirm_scoring_api(match_id: str):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    black_score, white_score, winner = final_scoring(game)
    return {
        "final_scored": True,
        "black_score": black_score,
        "white_score": white_score,
        "winner": winner,
    }


@router.get("/matches/{match_id}/export_sgf")
def export_sgf(match_id: str):
    """
    当前前端是 x=0 在底部，所以SGF常见 row=0 在顶部 => row = (board_size-1 - x)
    col = y 
    """
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
    导入时反向处理: row= (sz-1 - x)
    => x= (sz-1 - row)
    这样能够匹配前端 x=0 在底部
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
