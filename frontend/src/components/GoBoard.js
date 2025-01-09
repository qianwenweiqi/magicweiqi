import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./GoBoard.css";

const GoBoard = ({ boardSize = 19 }) => {
  const [board, setBoard] = useState(
    Array.from({ length: boardSize }, () => Array(boardSize).fill(null))
  );
  const [currentPlayer, setCurrentPlayer] = useState("black");
  const [message, setMessage] = useState("");
  const [matchId, setMatchId] = useState(null);

  // Local replay state
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Timers
  const [blackTime, setBlackTime] = useState(300);
  const [whiteTime, setWhiteTime] = useState(300);
  const timerRef = useRef(null);

  // Star points
  const starPoints = [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15],
  ];

  // Initialize a new game
  const startNewGame = () => {
    axios
      .post(
        "http://127.0.0.1:8000/api/v1/matches",
        { board_size: boardSize },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      )
      .then((res) => {
        setMatchId(res.data.match_id);
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setMessage("New game started!");

        // Reset history
        setHistory([res.data.board]);
        setCurrentStep(0);

        // Reset timers
        setBlackTime(300);
        setWhiteTime(300);
        if (timerRef.current) clearInterval(timerRef.current);
        startTimer(res.data.current_player);
      })
      .catch((err) => {
        console.error("Failed to create match:", err);
        setMessage("Failed to initialize the game.");
      });
  };

  useEffect(() => {
    startNewGame();
    // eslint-disable-next-line
  }, [boardSize]);

  const startTimer = (player) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (player === "black") {
        setBlackTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setMessage("Black loses on time!");
            return 0;
          }
          return prev - 1;
        });
      } else {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setMessage("White loses on time!");
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleCellClick = (x, y) => {
    if (!matchId) {
      setMessage("No match ID!");
      return;
    }
    if (currentStep < history.length - 1) {
      setMessage("You are replaying history, cannot move now.");
      return;
    }
    if (board[x][y] !== null) {
      setMessage("Cell occupied!");
      return;
    }

    axios
      .post(
        `http://127.0.0.1:8000/api/v1/matches/${matchId}/move`,
        { x, y },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      )
      .then((res) => {
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setMessage(res.data.message);

        const newHistory = history.slice(0, currentStep + 1);
        newHistory.push(res.data.board);
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);

        startTimer(res.data.current_player);
      })
      .catch((err) => {
        console.error("Error making a move:", err);
        setMessage(err.response?.data?.detail || "An error occurred");
      });
  };

  const handlePass = () => {
    if (!matchId) return;
    axios
      .post(
        `http://127.0.0.1:8000/api/v1/matches/${matchId}/move`,
        { x: null, y: null },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      )
      .then((res) => {
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setMessage(res.data.message);

        const newHistory = history.slice(0, currentStep + 1);
        newHistory.push(res.data.board);
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);

        startTimer(res.data.current_player);
      })
      .catch((err) => {
        console.error("Error passing:", err);
        setMessage(err.response?.data?.detail || "An error occurred");
      });
  };

  const handleResign = () => {
    if (!matchId) return;
    axios
      .post(
        `http://127.0.0.1:8000/api/v1/matches/${matchId}/resign`,
        { player: currentPlayer },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      )
      .then((res) => {
        setMessage(res.data.message);
        clearInterval(timerRef.current);
      })
      .catch((err) => {
        console.error("Error resigning:", err);
        setMessage(err.response?.data?.detail || "An error occurred");
      });
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      setBoard(history[newStep]);
      setMessage("Went to previous move.");
    }
  };

  const handleNext = () => {
    if (currentStep < history.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      setBoard(history[newStep]);
      setMessage("Went to next move.");
    }
  };

  const cells = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      const topPos = (x * 540) / (boardSize - 1);
      const leftPos = (y * 540) / (boardSize - 1);
      cells.push(
        <div
          key={`${x}-${y}`}
          className="board-cell"
          style={{ top: topPos, left: leftPos }}
          onClick={() => handleCellClick(x, y)}
        >
          {board[x][y] === "black" && <div className="stone black" />}
          {board[x][y] === "white" && <div className="stone white" />}
          {starPoints.some(([sx, sy]) => sx === x && sy === y) && (
            <div className="star-point" />
          )}
        </div>
      );
    }
  }

  return (
    <div>
      <div className="go-board-container">
        <div className="go-board">
          <div className="timer-panel black-timer">
            Black: {formatTime(blackTime)}
          </div>
          <div className="timer-panel white-timer">
            White: {formatTime(whiteTime)}
          </div>
          <div className="board">{cells}</div>
        </div>
      </div>

      <p>Current Player: {currentPlayer}</p>
      <p>{message}</p>

      <div className="controls">
        <button onClick={handlePrev} disabled={currentStep === 0}>
          Prev
        </button>
        <button onClick={handleNext} disabled={currentStep === history.length - 1}>
          Next
        </button>
        <button onClick={handlePass}>Pass</button>
        <button onClick={handleResign}>Resign</button>
        <button onClick={startNewGame}>New Game</button>
      </div>
    </div>
  );
};

export default GoBoard;
