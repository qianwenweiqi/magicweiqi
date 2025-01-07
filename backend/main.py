import uuid
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------- GoGame 类 ----------------
class GoGame:
    def __init__(self, board_size=19, komi=6.5):
        self.board_size = board_size
        self.komi = komi
        self.board = [[None for _ in range(board_size)] for _ in range(board_size)]
        self.history = []
        self.captured = {"black": 0, "white": 0}
        self.current_player = "black"
        self.passes = 0

    def is_on_board(self, x, y):
        return 0 <= x < self.board_size and 0 <= y < self.board_size

    def get_board_hash(self):
        board_string = ''.join(
            [''.join([cell[0] if cell else '.' for cell in row]) for row in self.board]
        )
        return hashlib.sha256(board_string.encode()).hexdigest()

    def is_valid_move(self, x, y, player):
        # 如果是 pass，则无需检测合法性
        if x is None and y is None:
            return True, ""

        if not self.is_on_board(x, y):
            return False, "Move out of bounds"
        if self.board[x][y] is not None:
            return False, "Cell already occupied"

        # 模拟落子，判断是否自杀
        self.board[x][y] = player
        if self.count_liberties(x, y) == 0:
            if not self.capture_stones(x, y, player, simulate=True):
                self.board[x][y] = None
                return False, "Suicide move"
        self.board[x][y] = None

        return True, ""

    def count_liberties(self, x, y, visited=None):
        if visited is None:
            visited = set()
        if (x, y) in visited:
            return 0
        visited.add((x, y))
        player = self.board[x][y]
        liberties = 0
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if self.is_on_board(nx, ny):
                if self.board[nx][ny] is None:
                    liberties += 1
                elif self.board[nx][ny] == player:
                    liberties += self.count_liberties(nx, ny, visited)
        return liberties

    def capture_stones(self, x, y, player, simulate=False):
        opponent = "white" if player == "black" else "black"
        captured_any = False
        to_capture = []

        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if self.is_on_board(nx, ny) and self.board[nx][ny] == opponent:
                if self.count_liberties(nx, ny) == 0:
                    group = self.get_group(nx, ny)
                    to_capture.extend(group)
                    captured_any = True

        if not simulate:
            for cx, cy in to_capture:
                self.board[cx][cy] = None
                self.captured[player] += 1

        return captured_any

    def get_group(self, x, y, visited=None):
        if visited is None:
            visited = set()
        group = []
        stack = [(x, y)]
        player = self.board[x][y]
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        while stack:
            cx, cy = stack.pop()
            if (cx, cy) in visited:
                continue
            visited.add((cx, cy))
            group.append((cx, cy))
            for dx, dy in directions:
                nx, ny = cx + dx, cy + dy
                if self.is_on_board(nx, ny) and self.board[nx][ny] == player:
                    stack.append((nx, ny))
        return group

    def play_move(self, x, y):
        # 如果是 pass
        if x is None and y is None:
            self.passes += 1
            self.current_player = "white" if self.current_player == "black" else "black"
            return True, f"Player passed."

        valid, message = self.is_valid_move(x, y, self.current_player)
        if not valid:
            return False, message

        # 落子
        self.board[x][y] = self.current_player
        self.capture_stones(x, y, self.current_player)

        # 判断是否出现打劫
        board_hash = self.get_board_hash()
        if board_hash in self.history:
            self.board[x][y] = None
            return False, "Ko detected"
        self.history.append(board_hash)

        # 切换玩家
        self.current_player = "white" if self.current_player == "black" else "black"
        self.passes = 0
        return True, "Move accepted"

# ---------------- FastAPI 应用 ----------------
app = FastAPI()

# 允许 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 如果前端在别的域名或端口，请改这里
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 用于保存所有对局
matches = {}

# 接收落子坐标的 Pydantic 模型
class Move(BaseModel):
    x: int | None = None
    y: int | None = None

@app.post("/api/v1/matches")
def create_match(board_size: int = 19):
    match_id = str(uuid.uuid4())
    new_game = GoGame(board_size=board_size)
    matches[match_id] = new_game
    return {
        "match_id": match_id,
        "board_size": board_size,
        "board": new_game.board
    }

@app.post("/api/v1/matches/{match_id}/move")
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

@app.get("/api/v1/matches/{match_id}")
def get_match(match_id: str):
    if match_id not in matches:
        raise HTTPException(status_code=404, detail="Match not found")
    game = matches[match_id]
    return {
        "board": game.board,
        "current_player": game.current_player
    }
