import React from "react";
import "./GoBoard.css";

/**
 * GoBoard:
 * - 19 x 19 交点，每个交点大小 30px => 整体 540x540
 * - starPoints 中记录星位(小目/天元等)
 * - 注意：这里 x 对应 行(纵向)，y 对应 列(横向)，
 *   因此我们直接用 board[x][y] 表示这枚子颜色
 *   并在显示时 top => x*30, left => y*30
 *
 * React.memo + 自定义对比函数 => 避免计时器等无关 state 变化时重复渲染
 */

function GoBoardComponent({
  boardSize = 19,
  board = [],           // board[x][y] => "black"/"white"/null
  isReplaying = false,
  onCellClick,
}) {
  // 星位
  const starPoints = [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15],
  ];

  const cells = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      // 这里故意 x,y => board[x][y]
      const stone = board[x]?.[y];
      if (stone) {
      }
      const isStar = starPoints.some(([sx, sy]) => sx === x && sy === y);
      const topPos = x * 30;
      const leftPos = y * 30;

      cells.push(
        <div
          key={`${x}-${y}`}
          className="board-cell"
          style={{ top: `${topPos}px`, left: `${leftPos}px` }}
          onClick={() => {
            if (!isReplaying && onCellClick) {
              onCellClick(x, y);
            }
          }}
        >
          {stone === "black" && (
            <div className="stone black" data-testid={`stone-${x}-${y}`} />
          )}
          {stone === "white" && (
            <div className="stone white" data-testid={`stone-${x}-${y}`} />
          )}
          {isStar && <div className="star-point" />}
        </div>
      );
    }
  }

  return (
    <div className="go-board-container">
      <div className="go-board">
        <div className="board">{cells}</div>
      </div>
    </div>
  );
}

/**
 * 自定义对比，以减少无关渲染:
 * 只有当 board/boardSize/isReplaying/onCellClick 改变时才重绘
 */
function areEqual(prevProps, nextProps) {
  if (prevProps.boardSize !== nextProps.boardSize) return false;
  if (prevProps.isReplaying !== nextProps.isReplaying) return false;
  if (prevProps.onCellClick !== nextProps.onCellClick) return false;

  // 深比较 board 数组内容
  if (prevProps.board.length !== nextProps.board.length) return false;
  for (let i = 0; i < prevProps.board.length; i++) {
    if (prevProps.board[i].length !== nextProps.board[i].length) return false;
    for (let j = 0; j < prevProps.board[i].length; j++) {
      if (prevProps.board[i][j] !== nextProps.board[i][j]) return false;
    }
  }
  return true;
}

export default React.memo(GoBoardComponent, areEqual);
