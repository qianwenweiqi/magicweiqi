import React, { useState, useEffect } from "react";
import axios from "axios";
import "./GoBoard.css";

const GoBoard = ({ boardSize = 19 }) => {
  // 棋盘状态
  const [board, setBoard] = useState(
    Array.from({ length: boardSize }, () => Array(boardSize).fill(null))
  );
  const [currentPlayer, setCurrentPlayer] = useState("black");
  const [message, setMessage] = useState("");
  const [matchId, setMatchId] = useState(null);

  // 历史记录（用于前端本地“上一手/下一手”回放）
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  // 计时：黑白各 15分钟(900秒)
  const [blackTime, setBlackTime] = useState(15 * 60);
  const [whiteTime, setWhiteTime] = useState(15 * 60);

  // 是否已开局(第一次落子或pass后开始计时)
  const [gameStarted, setGameStarted] = useState(false);

  // 是否已进入“复盘模式”(包括“Resign”或“超时”)
  const [resigned, setResigned] = useState(false);

  // ------------------ 初始化对局 ------------------
  // 注意：这个函数也给“New Game”按钮复用
  const startNewGame = () => {
    axios
      .post("http://127.0.0.1:8000/api/v1/matches", { board_size: boardSize })
      .then((res) => {
        setMatchId(res.data.match_id);
        setBoard(res.data.board);
        // 初始化本地状态
        setHistory([res.data.board]);
        setCurrentStep(0);
        setMessage("New game started!");
        setCurrentPlayer("black");
        setBlackTime(15 * 60);
        setWhiteTime(15 * 60);
        setGameStarted(false);
        setResigned(false);
      })
      .catch((err) => {
        console.error("Failed to initialize the board:", err);
        setMessage("Failed to initialize the game.");
      });
  };

  // 首次挂载时创建一局
  useEffect(() => {
    startNewGame();
    // eslint-disable-next-line
  }, [boardSize]);

  // ------------------ 计时逻辑 ------------------
  useEffect(() => {
    let timerId = null;

    // 在游戏开始且未进入复盘模式时，每秒扣减“当前玩家”的时间
    if (gameStarted && !resigned) {
      timerId = setInterval(() => {
        if (currentPlayer === "black") {
          setBlackTime((t) => {
            if (t <= 1) {
              // 黑棋超时
              clearInterval(timerId);
              setResigned(true);
              setMessage("Black is out of time. Black loses.");
              return 0;
            }
            return t - 1;
          });
        } else {
          setWhiteTime((t) => {
            if (t <= 1) {
              // 白棋超时
              clearInterval(timerId);
              setResigned(true);
              setMessage("White is out of time. White loses.");
              return 0;
            }
            return t - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [gameStarted, resigned, currentPlayer]);

  // 将秒数格式化成 mm:ss
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // ------------------ 上一手、下一手 ------------------
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setBoard(history[currentStep - 1]);
      setMessage("Went to previous move.");
    }
  };

  const handleNext = () => {
    if (currentStep < history.length - 1) {
      setCurrentStep(currentStep + 1);
      setBoard(history[currentStep + 1]);
      setMessage("Went to next move.");
    }
  };

  // ------------------ 处理落子 ------------------
  const handleCellClick = (x, y) => {
    // 如果已进入复盘模式(认输/超时等)，不允许继续下
    if (resigned) {
      setMessage("Game is over. Please start a new game or review the moves.");
      return;
    }

    // 如果正在回放历史，不允许下子
    if (currentStep < history.length - 1) {
      setMessage("You cannot make a move while replaying history.");
      return;
    }

    // 如果该位置已被占，提示
    if (board[x][y] !== null) {
      setMessage("This cell is already occupied!");
      return;
    }

    if (!matchId) {
      setMessage("Match ID is missing!");
      return;
    }

    // 第一次下子或pass后开始计时
    if (!gameStarted) {
      setGameStarted(true);
    }

    axios
      .post(`http://127.0.0.1:8000/api/v1/matches/${matchId}/move`, { x, y })
      .then((res) => {
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setMessage(res.data.message);

        // 更新历史记录
        const newHistory = history.slice(0, currentStep + 1);
        newHistory.push(res.data.board);
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);
      })
      .catch((err) => {
        console.error("Error making a move:", err.response?.data || err.message);
        setMessage(err.response?.data?.detail || "An error occurred");
      });
  };

  // ------------------ Pass ------------------
  const handlePass = () => {
    // 同样判断是否已结束
    if (resigned) {
      setMessage("Game is over. Please start a new game or review the moves.");
      return;
    }

    if (!matchId) {
      setMessage("Match ID is missing!");
      return;
    }

    // 同样：第一次pass也会启动计时
    if (!gameStarted) {
      setGameStarted(true);
    }

    // 传 x:null, y:null
    axios
      .post(`http://127.0.0.1:8000/api/v1/matches/${matchId}/move`, {
        x: null,
        y: null,
      })
      .then((res) => {
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setMessage(res.data.message);

        const newHistory = history.slice(0, currentStep + 1);
        newHistory.push(res.data.board);
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);
      })
      .catch((err) => {
        console.error("Error passing:", err.response?.data || err.message);
        setMessage(err.response?.data?.detail || "An error occurred");
      });
  };

  // ------------------ Resign ------------------
  const handleResign = () => {
    if (resigned) {
      setMessage("Game already finished.");
      return;
    }
    // 当前玩家认输
    setResigned(true);
    setMessage(`${currentPlayer === "black" ? "Black" : "White"} resigned. Game over.`);
  };

  // ------------------ 星位（9个） ------------------
  const starPoints = [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15],
  ];

  return (
    <div className="go-board">
      <h1>Go Game</h1>
      <p>Current Player: {currentPlayer === "black" ? "Black" : "White"}</p>
      <p>{message}</p>

      {/* 操作按钮 */}
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

      {/* 棋盘主体 */}
      <div className="board">
        {/* 黑棋计时器 (左上) */}
        <div className="timer black-timer">
          Black [●]: {formatTime(blackTime)}
        </div>
        {/* 白棋计时器 (右下) */}
        <div className="timer white-timer">
          White [○]: {formatTime(whiteTime)}
        </div>

        {/* 生成 19×19 的交叉点 */}
        {Array.from({ length: boardSize }).map((_, x) =>
          Array.from({ length: boardSize }).map((_, y) => (
            <div
              key={`${x}-${y}`}
              className="board-cell"
              style={{
                top: `${(x * 540) / (boardSize - 1)}px`,
                left: `${(y * 540) / (boardSize - 1)}px`,
              }}
              onClick={() => handleCellClick(x, y)}
            >
              {/* 如果这里是黑子 */}
              {board[x][y] === "black" && <div className="stone black" />}
              {/* 如果这里是白子 */}
              {board[x][y] === "white" && <div className="stone white" />}
              {/* 星位 (如果无棋子也要显示)，已用 z-index 调整到下面 */}
              {starPoints.some(([sx, sy]) => sx === x && sy === y) && (
                <div className="star-point" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GoBoard;
