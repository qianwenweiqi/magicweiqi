import hashlib
import copy

def finalize_game(match_id, game):
    """
    TODO:
    1) Update Elo (for real).
    2) Generate SGF and store to S3 (optional).
    3) Persist game result to DynamoDB.
    """
    # Example: winner +10 Elo, loser -10 Elo, etc.
    # generate_sgf(game)
    # store_to_ddb(match_id, game.winner, game.captured, <sgf_link>)
    pass

class GoGame:
    def __init__(self, board_size=19, komi=6.5):
        self.board_size = board_size
        self.komi = komi
        self.board = [[None for _ in range(board_size)] for _ in range(board_size)]
        self.history = []
        self.captured = {"black": 0, "white": 0}
        self.current_player = "black"
        self.passes = 0
        self.game_over = False
        self.winner = None

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

        # Temporarily place the stone
        self.board[x][y] = player

        # Check for suicide
        if self.count_liberties(x, y) == 0:
            # However, if it captures opponent stones, it's valid
            if not self.capture_stones(x, y, player, simulate=True):
                # revert
                self.board[x][y] = None
                return False, "Suicide move"

        # revert
        self.board[x][y] = None
        return True, ""

    def play_move(self, x, y):
        if self.game_over:
            return False, "Game is over."

        # If pass
        if x is None and y is None:
            self.passes += 1
            if self.passes >= 2:
                # 2 consecutive passes => game ends
                self.game_over = True
                self.winner = "Draw by consecutive passes"
                finalize_game("<some-match-id>", self)
            else:
                self.current_player = "white" if self.current_player == "black" else "black"
            return True, "Pass"

        valid, msg = self.is_valid_move(x, y, self.current_player)
        if not valid:
            return False, msg

        old_board = copy.deepcopy(self.board)
        old_captured = self.captured.copy()

        # Place the stone for real
        self.board[x][y] = self.current_player
        self.capture_stones(x, y, self.current_player)

        # Ko rule detection
        board_hash = self.get_board_hash()
        if board_hash in self.history:
            # revert (Ko)
            self.board = old_board
            self.captured = old_captured
            return False, "Ko detected"

        self.history.append(board_hash)
        self.current_player = "white" if self.current_player == "black" else "black"
        self.passes = 0
        return True, "Move accepted"

    def resign(self, player):
        if self.game_over:
            return False, "Game is already over."
        self.game_over = True
        opponent = "white" if player == "black" else "black"
        self.winner = f"{player} resigned, {opponent} wins"
        finalize_game("<some-match-id>", self)
        return True, self.winner
