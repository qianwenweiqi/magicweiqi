from backend.services.go_game import GoGame
from backend.models import CreateMatch
import logging
import time
from typing import Dict, Any
from datetime import datetime, timedelta
import threading

logger = logging.getLogger(__name__)

# Single source of truth for matches
matches: Dict[str, Dict[str, Any]] = {}  # match_id -> {game: GoGame, last_activity: datetime}
logger.info("Initialized matches dictionary in match_service")

# Match expiration settings
MATCH_TIMEOUT = timedelta(minutes=30)  # Inactive matches expire after 30 minutes
CLEANUP_INTERVAL = 300  # Cleanup runs every 5 minutes

def cleanup_expired_matches():
    """Periodically clean up expired matches"""
    while True:
        try:
            now = datetime.now()
            expired = [
                match_id for match_id, match_data in matches.items()
                if now - match_data['last_activity'] > MATCH_TIMEOUT
            ]
            
            if expired:
                logger.info(f"Cleaning up expired matches: {expired}")
                for match_id in expired:
                    del matches[match_id]
                    
        except Exception as e:
            logger.error(f"Error during match cleanup: {e}")
            
        time.sleep(CLEANUP_INTERVAL)

# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_expired_matches, daemon=True)
cleanup_thread.start()

def get_matches():
    """Get the matches dictionary"""
    active_matches = {
        match_id: match_data['game']
        for match_id, match_data in matches.items()
        if datetime.now() - match_data['last_activity'] <= MATCH_TIMEOUT
    }
    logger.info(f"Getting matches dictionary. Current active matches: {list(active_matches.keys())}")
    return active_matches

def create_match_internal(match_data: CreateMatch) -> dict:
    """Internal service function to create a match, used by both routers"""
    logger.info(f"Creating new match with players: {match_data.black_player} (black) vs {match_data.white_player} (white)")
    
    # 检查是否有SGF内容
    sgf_content = match_data.sgf_content
    logger.info(f"Creating game with SGF content: {sgf_content[:200] if sgf_content else 'None'}")
    
    try:
        game = GoGame(
            board_size=match_data.board_size,
            black_player=match_data.black_player,
            white_player=match_data.white_player,
            main_time=match_data.main_time,
            byo_yomi_time=match_data.byo_yomi_time,
            byo_yomi_periods=match_data.byo_yomi_periods,
            komi=match_data.komi,
            players=[match_data.black_player, match_data.white_player],
            sgf_content=sgf_content
        )
        
        # 打印棋盘状态用于调试
        board_str = "\n".join([" ".join("B" if cell == "black" else "W" if cell == "white" else "." for cell in row) for row in game.board])
        logger.info(f"Created game with board state:\n{board_str}")
        
    except Exception as e:
        logger.error(f"Error creating game with SGF: {e}")
        # 如果创建失败，创建一个没有SGF的新游戏
        game = GoGame(
            board_size=match_data.board_size,
            black_player=match_data.black_player,
            white_player=match_data.white_player,
            main_time=match_data.main_time,
            byo_yomi_time=match_data.byo_yomi_time,
            byo_yomi_periods=match_data.byo_yomi_periods,
            komi=match_data.komi,
            players=[match_data.black_player, match_data.white_player]
        )
    
    import uuid
    match_id = str(uuid.uuid4())
    matches[match_id] = {
        'game': game,
        'last_activity': datetime.now()
    }
    
    game.update_timers()
    # Update activity timestamp whenever match is accessed
    matches[match_id]['last_activity'] = datetime.now()
    
    return {
        "match_id": match_id,
        "match_url": f"/game/{match_id}",
        "board_size": match_data.board_size,
        "board": game.board,
        "current_player": game.current_player,
        "passes": game.passes,
        "captured": game.captured,
        "history_length": len(game.history),
        "game_over": game.game_over,
        "winner": game.winner,
        "black_player": match_data.black_player,
        "white_player": match_data.white_player,
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
