from pydantic import BaseModel
from typing import List, Optional

class Move(BaseModel):
    x: Optional[int] = None
    y: Optional[int] = None

class CreateMatch(BaseModel):
    board_size: int = 19

class Player(BaseModel):
    player_id: str
    elo: int
    is_black: bool = False
    avatar_url: str = ""  # 头像链接

class Card(BaseModel):
    card_id: str
    name: str
    description: str
    cost: int

class ResignRequest(BaseModel):
    player: str  # "black" or "white"
