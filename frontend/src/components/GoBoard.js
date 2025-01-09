import React, { useState, useEffect, useRef } from "react";
import "./GoBoard.css";

/**
 * GoBoard
 * - Shows a 19x19 board with star points
 * - Local timers for black & white
 * - Freezes timers if isReplaying=true or game is over
 * - Calls onCellClick(x, y) when user clicks an intersection
 */
const GoBoard = ({
  boardSize = 19,
  board = [],
  currentPlayer = "black",
  isReplaying = false,
  onCellClick,
}) => {
  // 5 minutes in seconds for each side:
  const [blackTime, setBlackTime] = useState(300);
  const [whiteTime, setWhiteTime] = useState(300);
  const timerRef = useRef(null);

  // star points
  const starPoints = [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15],
  ];

  // Restart timers whenever currentPlayer changes (if not replaying)
  useEffect(() => {
    if (isReplaying) {
      // If replaying, freeze timers:
      clearInterval(timerRef.current);
      return;
    }

    // Clear old interval first
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      if (currentPlayer === "black") {
        setBlackTime((prev) => (prev > 0 ? prev - 1 : 0));
      } else {
        setWhiteTime((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentPlayer, isReplaying]);

  // Generate board cells
  const cells = [];
  // Each intersection spaced by 30px => total 18 gaps * 30 = 540
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      const topPos = x * 30;
      const leftPos = y * 30;
      const stone = board[x]?.[y]; // "black" or "white" or null

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
          {stone === "black" && <div className="stone black" />}
          {stone === "white" && <div className="stone white" />}
          {starPoints.some(([sx, sy]) => sx === x && sy === y) && (
            <div className="star-point" />
          )}
        </div>
      );
    }
  }

  // Format mm:ss
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="go-board-container">
      <div className="go-board">
        {/* Timers in corners */}
        <div className="timer-panel black-timer">
          Black: {formatTime(blackTime)}
        </div>
        <div className="timer-panel white-timer">
          White: {formatTime(whiteTime)}
        </div>

        <div className="board">{cells}</div>
      </div>
    </div>
  );
};

export default GoBoard;
