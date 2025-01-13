# backend/services/go_game.py
import hashlib
import copy
import time

def finalize_game(match_id, game):
    # TODO: ELO计算/存储等
    pass

class GoGame:
    def __init__(self, board_size=19, komi=6.5, black_player=None, white_player=None, players=None):
        self.board_size = board_size
        self.komi = komi
        self.board = [[None for _ in range(board_size)] for _ in range(board_size)]
        self.history = []
        self.captured = {"black": 0, "white": 0}
        self.current_player = "black"
        self.passes = 0
        self.game_over = False
        self.winner = None
        self.timers = {
            "black": {
                "main_time": 0,
                "byo_yomi": 0,
                "periods": 0,
                "last_update": None
            },
            "white": {
                "main_time": 0,
                "byo_yomi": 0,
                "periods": 0,
                "last_update": None
            }
        }
        
        # Player information
        self.black_player = black_player
        self.white_player = white_player
        self.players = players or [black_player, white_player]  # Track all players

        # Game state
        self.dead_stones = set()  # (x, y)
        self.move_records = []    # [(color, x, y), ...]

    def is_on_board(self, x, y):
        return 0 <= x < self.board_size and 0 <= y < self.board_size

    def get_board_hash(self):
        board_string = ''.join(
            ''.join((cell[0] if cell else '.') for cell in row)
            for row in self.board
        )
        return hashlib.sha256(board_string.encode()).hexdigest()

    def count_liberties(self, x, y, visited=None):
        if visited is None:
            visited = set()
        if (x, y) in visited:
            return 0
        visited.add((x, y))
        player = self.board[x][y]
        liberties = 0
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if self.is_on_board(nx, ny):
                if self.board[nx][ny] is None:
                    liberties += 1
                elif self.board[nx][ny] == player:
                    liberties += self.count_liberties(nx, ny, visited)
        return liberties

    def get_group(self, x, y, visited=None):
        if visited is None:
            visited = set()
        group = []
        stack = [(x, y)]
        player = self.board[x][y]
        while stack:
            cx, cy = stack.pop()
            if (cx, cy) in visited:
                continue
            visited.add((cx, cy))
            group.append((cx, cy))
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = cx + dx, cy + dy
                if self.is_on_board(nx, ny) and self.board[nx][ny] == player:
                    stack.append((nx, ny))
        return group

    def capture_stones(self, x, y, player, simulate=False):
        opponent = "white" if player == "black" else "black"
        captured_any = False
        to_capture = []

        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if self.is_on_board(nx, ny) and self.board[nx][ny] == opponent:
                if self.count_liberties(nx, ny) == 0:
                    group = self.get_group(nx, ny)
                    to_capture.extend(group)
                    captured_any = True

        if not simulate and captured_any:
            for cx, cy in to_capture:
                self.board[cx][cy] = None
            self.captured[player] += len(to_capture)

        return captured_any

    def is_valid_move(self, x, y, player):
        if not self.is_on_board(x, y):
            return False, "Move out of bounds"
        if self.board[x][y] is not None:
            return False, "Cell already occupied"

        self.board[x][y] = player
        if self.count_liberties(x, y) == 0:
            if not self.capture_stones(x, y, player, simulate=True):
                self.board[x][y] = None
                return False, "Suicide move"
        self.board[x][y] = None
        return True, ""

    def update_timers(self):
        """Update timers based on current time"""
        if self.game_over:
            return

        current_time = time.time()
        player = self.current_player
        opponent = "white" if player == "black" else "black"
        
        # Update opponent's timer first
        if self.timers[opponent]["last_update"]:
            elapsed = current_time - self.timers[opponent]["last_update"]
            if self.timers[opponent]["main_time"] > 0:
                self.timers[opponent]["main_time"] = max(0, self.timers[opponent]["main_time"] - elapsed)
            elif self.timers[opponent]["byo_yomi"] > 0:
                self.timers[opponent]["byo_yomi"] = max(0, self.timers[opponent]["byo_yomi"] - elapsed)
                if self.timers[opponent]["byo_yomi"] <= 0:
                    self.timers[opponent]["periods"] -= 1
                    if self.timers[opponent]["periods"] > 0:
                        self.timers[opponent]["byo_yomi"] = self.timers[opponent]["byo_yomi"]
                    else:
                        self.game_over = True
                        self.winner = f"{player} wins by timeout"
                        finalize_game("<some-match-id>", self)
                        return

        # Update current player's timer
        self.timers[player]["last_update"] = current_time

    def play_move(self, x, y):
        if self.game_over:
            return False, "Game is over."

        # Update timers before processing move
        self.update_timers()
        if self.game_over:
            return False, self.winner

        if x is None and y is None:
            self.passes += 1
            if self.passes >= 2:
                self.game_over = True
                self.winner = "Draw by consecutive passes"
                finalize_game("<some-match-id>", self)
            else:
                self.current_player = "white" if self.current_player == "black" else "black"
                self.update_timers()
            return True, "Pass"

        valid, msg = self.is_valid_move(x, y, self.current_player)
        if not valid:
            return False, msg

        old_board = copy.deepcopy(self.board)
        old_captured = self.captured.copy()

        self.board[x][y] = self.current_player
        self.capture_stones(x, y, self.current_player)

        board_hash = self.get_board_hash()
        if board_hash in self.history:
            self.board = old_board
            self.captured = old_captured
            return False, "Ko detected"

        self.history.append(board_hash)
        self.move_records.append((self.current_player, x, y))

        self.current_player = "white" if self.current_player == "black" else "black"
        self.passes = 0
        self.update_timers()
        return True, "Move accepted"

    def resign(self, player):
        if self.game_over:
            return False, "Game is already over."
        self.game_over = True
        opponent = "white" if player == "black" else "black"
        self.winner = f"{player} resigned, {opponent} wins"
        finalize_game("<some-match-id>", self)
        return True, self.winner
