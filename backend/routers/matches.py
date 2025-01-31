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
    """
    通过HTTP创建一个新的对局 (通常是由房间系统自动调用)
    """
    if data.black_player == data.white_player:
        raise HTTPException(status_code=400, detail="Black and white players cannot be the same")
    
    result = create_match_internal(data)
    matches = get_matches()
    logger.info(f"Created new match with id: {result['match_id']}")
    logger.info(f"Current matches: {list(matches.keys())}")
    return result


@router.get("/matches/{match_id}")
def get_match(match_id: str):
    """
    获取对局的最新信息(棋盘、计时等)。前端刷新页面时可调用一次，以便拿到对局状态。
    """
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
    """
    获取对局玩家信息（用户名、是否黑棋/白棋、ELO等）。
    """
    matches = get_matches()
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    return {
        "players": [
            Player(
                player_id=game.black_player,
                elo=0,  # TODO: 待后续实现真实ELO
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
        "black_cards": [],  # TODO: Card系统未实现
        "white_cards": [],
    }


# ============ 移除HTTP方式的落子、认输、标记死子、确认数子、更新对局状态等接口 ============
# 这些操作已改为WebSocket事件，请前往 backend/main.py 中查看 move_stone、resign、mark_dead_stone等事件。
#
# 原先如下HTTP路由已被弃用:
# @router.post("/matches/{match_id}/move") -> 通过 socket: move_stone
# @router.post("/matches/{match_id}/resign") -> 通过 socket: resign
# @router.post("/matches/{match_id}/mark_dead_stone") -> 通过 socket: mark_dead_stone
# @router.post("/matches/{match_id}/confirm_scoring") -> 通过 socket: confirm_scoring
# @router.post("/matches/{match_id}/update_status") -> 通过 socket: update_status
#
# 保留下列接口: export_sgf, review_sgf(用于文件上传解析)


@router.get("/matches/{match_id}/export_sgf")
def export_sgf(match_id: str):
    """
    导出SGF棋谱
    x=0 在底行, SGF row=0 在顶行 => row=(board_size-1 - x), col=y
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
    将SGF解析为落子序列，用于复盘。
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
