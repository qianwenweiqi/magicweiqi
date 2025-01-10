// frontend/src/components/GoBoard.js

import React from "react";
import "./GoBoard.css";

/**
 * GoBoard
 * - NxN board
 * - isFlipped=true -> 180°翻转
 * - onCellClick(x,y) => place stone
 */
function GoBoard({
  boardSize = 19,
  board = [],
  currentPlayer = "black",
  isReplaying = false,
  isFlipped = false,
  onCellClick,
}) {
  const starPoints = [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15],
  ];

  const cells = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      // 如果翻转
      const rx = isFlipped ? boardSize - 1 - x : x;
      const ry = isFlipped ? boardSize - 1 - y : y;

      const stone = board[rx]?.[ry];
      // 这里 x,y 用于渲染DOM位置
      // topPos/leftPos 加 15px padding => 半格 padding
      const topPos = x * 30 + 15;
      const leftPos = y * 30 + 15;

      cells.push(
        <div
          key={`${x}-${y}`}
          className="board-cell"
          style={{ top: `${topPos}px`, left: `${leftPos}px` }}
          onClick={() => {
            if (!isReplaying && onCellClick) {
              onCellClick(rx, ry);
            }
          }}
        >
          {stone === "black" && <div className="stone black" />}
          {stone === "white" && <div className="stone white" />}
          {starPoints.some(([sx, sy]) => sx === rx && sy === ry) && (
            <div className="star-point" />
          )}
        </div>
      );
    }
  }

  return <div className="go-board-container">
    <div className="board">{cells}</div>
  </div>;
}

export default GoBoard;
