import hashlib
import copy
import time
import logging

logger = logging.getLogger(__name__)

def finalize_game(match_id, game):
    """
    当对局结束时，可在此处进行ELO计算、存储对局结果等自定义逻辑。
    当前函数仅作占位示例。
    """
    pass

class GoGame:
    """
    GoGame 用于表示一个围棋对局的核心数据和操作逻辑。

    - board_size: 棋盘大小(默认19路)
    - komi: 贴目(默认6.5)
    - black_player / white_player: 双方玩家ID，用于记录是谁执黑或执白
    - players: 可选的玩家列表，后续可能扩展多人旁观、AI对弈等
    - main_time / byo_yomi_time / byo_yomi_periods: 计时规则相关
    - sgf_content: 如果传入SGF内容，则在初始化时直接复盘到对应棋面
    """

    def __init__(
        self,
        board_size=19,
        komi=6.5,
        black_player=None,
        white_player=None,
        players=None,
        main_time=300,
        byo_yomi_time=30,
        byo_yomi_periods=3,
        sgf_content=None
    ):
        """
        初始化GoGame对象:
          - 创建空白棋盘
          - 初始化计时器
          - 如果有SGF内容，则调用 _init_from_sgf() 解析并落子到当前棋盘
        """
        self.board_size = board_size
        self.komi = komi

        # 创建 board_size x board_size 的空棋盘
        self.board = [[None for _ in range(board_size)] for _ in range(board_size)]

        # 棋局相关的基础状态
        self.history = []            # 用于记录局面哈希，检测打劫等
        self.captured = {"black": 0, "white": 0}
        self.current_player = "black"
        self.passes = 0
        self.game_over = False
        self.winner = None

        # 注意：一定要先初始化 move_records ，
        # 以免在 _init_from_sgf() 中 self.move_records.append(...) 时出错
        self.move_records = []  # 用于记录每一步 (color, x, y)

        # 记录当前时间，用于计时器
        current_time = time.time()

        # 计时器信息
        self.timers = {
            "black": {
                "main_time": main_time,
                "byo_yomi": byo_yomi_time,
                "periods": byo_yomi_periods,
                "last_update": current_time
            },
            "white": {
                "main_time": main_time,
                "byo_yomi": byo_yomi_time,
                "periods": byo_yomi_periods,
                "last_update": current_time
            }
        }

        # 玩家信息
        self.black_player = black_player
        self.white_player = white_player
        # 可以扩展为 [black_player, white_player, 观战者1, 观战者2, ...]
        self.players = players or [black_player, white_player]

        # 记录本局中被标记为死子的坐标集，用于点目/数死子
        self.dead_stones = set()

        # 如果提供了SGF内容，则尝试根据SGF初始化棋盘
        if sgf_content:
            logger.info(
                f"Initializing board from SGF content: "
                f"{sgf_content[:200]}..."
            )
            self._init_from_sgf(sgf_content)
            # SGF初始化后，默认当前下子方为黑棋
            self.current_player = "black"
        else:
            logger.info("No SGF content provided")

    def _init_from_sgf(self, sgf_content: str):
        """
        从给定的 SGF 内容初始化棋盘：
          1. 使用 sgfmill 库解析SGF
          2. 按顺序重放所有落子到 self.board
          3. 将每一步记录到 self.move_records
          4. 解析失败时，会重置成空棋盘并清空 move_records
        """
        try:
            from sgfmill import sgf
            logger.info("Starting SGF parsing")

            # SGF是文本格式，这里需转成字节
            sgf_bytes = sgf_content.encode('utf-8')
            sgf_game = sgf.Sgf_game.from_bytes(sgf_bytes)

            # 若SGF大小与当前board_size不一致，尝试同步到SGF大小
            size = sgf_game.get_size()
            if size != self.board_size:
                logger.info(
                    f"Adjusting board size from {self.board_size} to SGF size {size}"
                )
                self.board_size = size
                self.board = [[None for _ in range(size)] for _ in range(size)]

            # 获取所有主分支上的着手 (不考虑变体分支)
            moves = []
            for node in sgf_game.get_main_sequence():
                color, move = node.get_move()
                if color and move:
                    row, col = move
                    # sgf中 row=0 表示顶行，col=0 表示左列
                    # 我们的board中 x=0 表示底行，所以要做一下转换
                    x = size - 1 - row
                    y = col
                    stone_color = "black" if color == "b" else "white"
                    moves.append((stone_color, x, y))

            logger.info(f"Found {len(moves)} moves in SGF")

            # 按顺序将SGF中的每步落子放置到 self.board
            for (color, x, y) in moves:
                if self.is_on_board(x, y):
                    logger.info(f"Placing {color} stone at ({x}, {y})")
                    if self.board[x][y] is not None:
                        logger.warning(
                            f"Position ({x}, {y}) already occupied by {self.board[x][y]}"
                        )
                    self.board[x][y] = color
                    # 记录在 move_records
                    self.move_records.append((color, x, y))

                    # 计算历史哈希
                    board_hash = self.get_board_hash()
                    self.history.append(board_hash)
                else:
                    logger.warning(f"Move ({x}, {y}) is out of board")

            # 打印最终棋盘用于调试
            board_str = "\n".join([
                " ".join(
                    "B" if cell == "black"
                    else "W" if cell == "white"
                    else "."
                    for cell in row
                )
                for row in self.board
            ])
            logger.info(f"Final board state:\n{board_str}")

        except Exception as e:
            logger.error(f"Error parsing SGF: {e}")
            # 如果解析失败，就把棋盘重置为空，并清空 move_records
            self.board = [[None for _ in range(self.board_size)]
                          for _ in range(self.board_size)]
            self.move_records = []
            self.history = []

    def is_on_board(self, x, y) -> bool:
        """判断 (x, y) 是否在有效棋盘范围内。"""
        return 0 <= x < self.board_size and 0 <= y < self.board_size

    def get_board_hash(self) -> str:
        """
        计算当前棋盘的哈希，以检测打劫等。
        每个位置取首字母(b/w)或 '.' 连接起来，再做sha256。
        """
        board_string = ''.join(
            ''.join((cell[0] if cell else '.') for cell in row)
            for row in self.board
        )
        return hashlib.sha256(board_string.encode()).hexdigest()

    def count_liberties(self, x, y, visited=None) -> int:
        """
        递归统计某块的气数量。
        visited 用于避免重复访问。
        """
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
        """
        获取与 (x,y) 同色相连的一整块棋子的坐标集合。
        用于后续提子操作。
        """
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

    def capture_stones(self, x, y, player, simulate=False) -> bool:
        """
        判断并执行对落子周围的对方棋块是否可提取。
          - 如果可以提，则从棋盘移除，更新 captured 数
          - simulate=True 时不真正提子，只检测是否可提，用于判断自杀
        返回是否有提子发生。
        """
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

    def is_valid_move(self, x, y, player) -> (bool, str):
        """
        快速校验落子是否有效(非越界、非落在已有子上、非自杀/打劫等)。
        打劫检测放在 play_move 中通过 self.history 完成。
        这里仅做自杀判断等。
        """
        if not self.is_on_board(x, y):
            return False, "Move out of bounds"
        if self.board[x][y] is not None:
            return False, "Cell already occupied"

        # 临时把子放上去，检查是否自杀
        self.board[x][y] = player
        if self.count_liberties(x, y) == 0:
            # 如果没有吃到对手任何棋，那就是自杀
            if not self.capture_stones(x, y, player, simulate=True):
                self.board[x][y] = None
                return False, "Suicide move"
        self.board[x][y] = None

        return True, ""

    def update_timers(self):
        """
        每次落子或操作前都可调用本函数，以扣除当前执棋方的时间。
        如果时间耗尽则自动判负。
        """
        if self.game_over:
            return

        current_time = time.time()
        player = self.current_player
        timer = self.timers[player]

        if timer["last_update"]:
            elapsed = current_time - timer["last_update"]

            # 先耗主时间
            if timer["main_time"] > 0:
                timer["main_time"] = max(0, timer["main_time"] - elapsed)
            # 主时间耗尽后，进入读秒
            elif timer["byo_yomi"] > 0:
                timer["byo_yomi"] = max(0, timer["byo_yomi"] - elapsed)
                if timer["byo_yomi"] <= 0:
                    timer["periods"] -= 1
                    if timer["periods"] > 0:
                        # 还有剩余读秒周期则重置读秒
                        timer["byo_yomi"] = self.timers[player]["byo_yomi"]
                    else:
                        # 所有读秒都用完 => 判负
                        self.game_over = True
                        opponent = "white" if player == "black" else "black"
                        self.winner = f"{opponent} wins by timeout"
                        finalize_game("<some-match-id>", self)
                        return

        # 更新 last_update
        timer["last_update"] = current_time

    def play_move(self, x, y) -> (bool, str):
        """
        在(x,y)处落子。若 x,y 均为 None，表示pass。
          - 检查打劫、提子、自杀、时间等
          - pass 连续两次 => 结束
        返回 (success, message)。
        """
        if self.game_over:
            return False, "Game is over."

        # 落子前先更新计时
        self.update_timers()
        if self.game_over:
            # 可能刚好时间耗尽
            return False, self.winner

        if x is None and y is None:
            # pass
            self.passes += 1
            if self.passes >= 2:
                self.game_over = True
                self.winner = "Draw by consecutive passes"
                finalize_game("<some-match-id>", self)
            else:
                self.current_player = (
                    "white" if self.current_player == "black" else "black"
                )
                self.update_timers()
            return True, "Pass"

        # 非pass => 正常落子
        valid, msg = self.is_valid_move(x, y, self.current_player)
        if not valid:
            return False, msg

        # 先保存落子前的状态，用于检测打劫
        old_board = copy.deepcopy(self.board)
        old_captured = self.captured.copy()

        # 落子
        self.board[x][y] = self.current_player
        self.capture_stones(x, y, self.current_player)

        # 计算新的局面hash，用于检测打劫
        board_hash = self.get_board_hash()
        if board_hash in self.history:
            # 打劫 => 回滚
            self.board = old_board
            self.captured = old_captured
            return False, "Ko detected"

        # 一切正常 => 写入历史
        self.history.append(board_hash)
        self.move_records.append((self.current_player, x, y))

        # 重置连pass计数
        self.passes = 0

        # 切换执棋方
        self.current_player = "white" if self.current_player == "black" else "black"

        # 落子完成后再次更新计时，以便下一个玩家的计时起点正确
        self.update_timers()
        return True, "Move accepted"

    def resign(self, player: str) -> (bool, str):
        """
        某一方认输。
        返回 (success, message)
        """
        if self.game_over:
            return False, "Game is already over."

        self.game_over = True
        opponent = "white" if player == "black" else "black"
        self.winner = f"{player} resigned, {opponent} wins"
        finalize_game("<some-match-id>", self)
        return True, self.winner
