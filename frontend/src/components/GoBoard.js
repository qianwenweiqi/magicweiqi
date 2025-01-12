import React from "react";
import "./GoBoard.css";

/**
 * GoBoard
 * - 19x19交点，每格30px -> 540x540
 * - Star points
 * - onCellClick(x, y)
 */
const GoBoard = ({
  boardSize = 19,
  board = [],           //  board[x][y] => "black"/"white"/null
  isReplaying = false,
  onCellClick,
}) => {
  // 星位
  const starPoints = [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15],
  ];

  // 生成 19x19 交点
  const cells = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      // 1) stone => board[x][y]
      const stone = board[x]?.[y];
      // 2) starPoint => starPoints里是否包含 (x,y)
      const isStar = starPoints.some(([sx, sy]) => sx === x && sy === y);

      // 4) 视觉上：top/left => x,y * 30
      const topPos = x * 30;
      const leftPos = y * 30;

      cells.push(
        <div
          key={`${x}-${y}`}
          className="board-cell"
          style={{ top: `${topPos}px`, left: `${leftPos}px` }}
          onClick={() => {
            if (!isReplaying && onCellClick) {
              // 点击时把 x, y 发给父组件
              onCellClick(x, y);
            }
          }}
        >
          {stone === "black" && <div className="stone black" />}
          {stone === "white" && <div className="stone white" />}
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
};

export default GoBoard;
