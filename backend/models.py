from pydantic import BaseModel
from typing import List, Optional

class Move(BaseModel):
    x: int
    y: int

class CreateMatch(BaseModel):
    board_size: int = 19
    black_player: str
    white_player: str

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
