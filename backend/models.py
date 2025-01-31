from pydantic import BaseModel
from typing import List, Optional

class Move(BaseModel):
    x: int
    y: int

class CreateMatch(BaseModel):
    board_size: int = 19
    black_player: str
    white_player: str
    main_time: int = 300  # Initial time in seconds
    byo_yomi_time: int = 30
    byo_yomi_periods: int = 3
    komi: float = 6.5
    handicap: int = 0
    sgf_content: Optional[str] = None  # SGF内容，用于从SGF创建游戏

class MatchState(BaseModel):
    match_id: str
    board: List[List[str]]
    current_player: str
    passes: int
    captured: dict
    history_length: int
    game_over: bool
    winner: Optional[str]
    black_time: int  # Current black time remaining
    white_time: int  # Current white time remaining

class Player(BaseModel):
    player_id: str
    elo: int
    is_black: bool = False
    avatar_url: str = ""

class Card(BaseModel):
    card_id: str
    name: str
    description: str
    cost: int

class ResignRequest(BaseModel):
    player: str  # "black" or "white"
