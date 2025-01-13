# backend/services/scoring.py

def mark_dead_stone(game, x, y, current_player):
    """
    简单逻辑：只允许标记当前执棋方颜色的子为死子。
    """
    if game.board[x][y] != current_player:
        return
    pos = (x, y)
    if pos in game.dead_stones:
        game.dead_stones.remove(pos)
    else:
        game.dead_stones.add(pos)


def final_scoring(game):
    """
    基于 game.dead_stones, 简单计算中国规则的目数 + 提子数 + komi。
    """
    size = game.board_size
    board_copy = []
    for r in range(size):
        board_copy.append(game.board[r][:])

    # 提走死子
    for (x, y) in game.dead_stones:
        board_copy[x][y] = None

    visited = set()
    black_territory = 0
    white_territory = 0

    def neighbors(r, c):
        for (dr, dc) in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r+dr, c+dc
            if 0 <= nr < size and 0 <= nc < size:
                yield nr, nc

    # flood fill 空交点
    for r in range(size):
        for c in range(size):
            if board_copy[r][c] is None and (r,c) not in visited:
                queue = [(r,c)]
                territory_points = []
                color_set = set()
                while queue:
                    rr, cc = queue.pop()
                    if (rr, cc) in visited:
                        continue
                    visited.add((rr, cc))
                    territory_points.append((rr, cc))
                    for nr, nc in neighbors(rr, cc):
                        if 0 <= nr < size and 0 <= nc < size:
                            if board_copy[nr][nc] is None and (nr,nc) not in visited:
                                queue.append((nr,nc))
                            elif board_copy[nr][nc] in ("black", "white"):
                                color_set.add(board_copy[nr][nc])

                if len(color_set) == 1:
                    if "black" in color_set:
                        black_territory += len(territory_points)
                    elif "white" in color_set:
                        white_territory += len(territory_points)

    # 数在棋盘上的存活子
    black_stones = 0
    white_stones = 0
    for r in range(size):
        for c in range(size):
            if board_copy[r][c] == "black":
                black_stones += 1
            elif board_copy[r][c] == "white":
                white_stones += 1

    black_score = black_territory + black_stones
    white_score = white_territory + white_stones + game.komi

    if black_score > white_score:
        winner = "Black"
    elif white_score > black_score:
        winner = "White"
    else:
        winner = "Draw"

    game.game_over = True
    game.winner = winner + " by scoring"
    return black_score, white_score, game.winner
