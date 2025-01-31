// frontend/src/pages/ReviewRoom.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button, Typography } from "@mui/material";
import GoBoard from "../components/GoBoard";
import { API_BASE_URL } from "../config/config";
import axios from "axios";
import { useGame } from "../context/GameContext";

function ReviewRoom() {
  const boardSize = 19;
  const emptyBoard = Array.from({ length: boardSize }, () =>
    Array(boardSize).fill(null)
  );

  const [moves, setMoves] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [scoringMode, setScoringMode] = useState(false);
  const [gameId, setGameId] = useState(null);
  const boardHistory = useRef([]);

  const { state: gameState, dispatch: gameDispatch } = useGame();
  const { board } = gameState;

  // 创建新的游戏实例
  const createGame = useCallback(async () => {
    try {
      // 如果已经有gameId，先删除旧的游戏
      if (gameId) {
        await axios.delete(`${API_BASE_URL}/api/v1/matches/${gameId}`);
        setGameId(null);
      }

      const response = await axios.post(`${API_BASE_URL}/api/v1/matches`, {
        black_player: "black",
        white_player: "white",
        board_size: boardSize
      });
      
      const newGameId = response.data.match_id;
      setGameId(newGameId);

      // 清空历史记录
      boardHistory.current = [emptyBoard.map(row => [...row])];

      return newGameId;
    } catch (err) {
      console.error("Error creating game:", err);
      setError("Failed to create game");
      return null;
    }
  }, [gameId, boardSize]);

  // 执行单步落子并保存棋盘状态
  const playMove = useCallback(async (step) => {
    if (!gameId) return;

    try {
      const { color, x, y } = moves[step];
      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        await axios.post(`${API_BASE_URL}/api/v1/matches/${gameId}/move`, {
          player: color,
          x,
          y
        });
        
        const gameState = await axios.get(`${API_BASE_URL}/api/v1/matches/${gameId}`);
        if (gameState.data.board) {
          // 保存这一步的棋盘状态
          boardHistory.current[step + 1] = gameState.data.board;
          
          gameDispatch({ 
            type: "LOAD_MATCH", 
            payload: {
              board: gameState.data.board,
              current_player: "black",
              passes: 0,
              captured: { black: 0, white: 0 },
              game_over: false,
              winner: null
            }
          });
        }
      }
    } catch (err) {
      console.error("Error playing move:", err);
      setError("Failed to play move");
    }
  }, [gameId, moves, boardSize, gameDispatch]);

  // 处理步骤变化
  useEffect(() => {
    const handleStepChange = async () => {
      if (currentStep > boardHistory.current.length - 1) {
        // 需要前进：执行新的落子
        await playMove(currentStep - 1);
      } else {
        // 需要后退：直接使用历史棋盘状态
        const historicalBoard = boardHistory.current[currentStep];
        gameDispatch({ 
          type: "LOAD_MATCH", 
          payload: {
            board: historicalBoard,
            current_player: "black",
            passes: 0,
            captured: { black: 0, white: 0 },
            game_over: false,
            winner: null
          }
        });
      }
    };

    handleStepChange();
  }, [currentStep, playMove, gameDispatch]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => (prev < moves.length ? prev + 1 : prev));
  }, [moves.length]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.deltaY > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    };

    window.addEventListener("wheel", handleWheel);
    return () => window.removeEventListener("wheel", handleWheel);
  }, [handleNext, handlePrev]);

  const handleFileUpload = async (e) => {
    setError("");
    const file = e.target.files[0];
    if (!file) return;

    setUploadedFileName(file.name);

    // Check if we have the SGF data in localStorage
    const cachedData = localStorage.getItem(`sgf_${file.name}`);
    if (cachedData) {
      try {
        const movesData = JSON.parse(cachedData);
        setMoves(movesData);
        setCurrentStep(0);
        // 创建新的游戏实例
        await createGame();
        return;
      } catch (err) {
        console.error("Failed to parse cached data:", err);
        // If parsing fails, continue with API call
      }
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/v1/review_sgf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const movesData = res.data.moves;
      // Store the moves data in localStorage
      localStorage.setItem(`sgf_${file.name}`, JSON.stringify(movesData));
      setMoves(movesData);
      setCurrentStep(0);
      // 创建新的游戏实例
      await createGame();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to parse SGF");
    }
  };

  const handleRequestCounting = () => {
    if (scoringMode) {
      setError("Already in scoring mode.");
      return;
    }
    setScoringMode(true);
  };

  const handleCancelScoring = () => {
    setScoringMode(false);
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 重置GameContext
      gameDispatch({ type: "RESET_GAME" });
      // 删除游戏实例
      if (gameId) {
        axios.delete(`${API_BASE_URL}/api/v1/matches/${gameId}`).catch(err => {
          console.error("Failed to delete game:", err);
        });
      }
    };
  }, [gameDispatch, gameId]);

  return (
    <div style={{ margin: 10 }}>
      <Typography variant="h4" gutterBottom>
        Review Room
      </Typography>
      <Button variant="contained" component="label" sx={{ mb: 2 }}>
        Upload SGF
        <input type="file" hidden onChange={handleFileUpload} />
      </Button>

      {uploadedFileName && (
        <Typography variant="body1" sx={{ mb: 2 }}>
          Uploaded: {uploadedFileName}
        </Typography>
      )}

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <GoBoard
        boardSize={boardSize}
        board={board}
        isReplaying={true} // 复盘模式下不可落子
      />

      <div style={{ marginTop: 20 }}>
        <Button onClick={handlePrev} variant="outlined" style={{ margin: 4 }}>
          Prev
        </Button>
        <Button onClick={handleNext} variant="outlined" style={{ margin: 4 }}>
          Next
        </Button>
        <Button
          onClick={handleRequestCounting}
          variant="outlined"
          style={{ margin: 4 }}
        >
          Request Counting
        </Button>
        {scoringMode && (
          <Button
            onClick={handleCancelScoring}
            variant="outlined"
            style={{ margin: 4 }}
          >
            Cancel Counting
          </Button>
        )}
      </div>
      <Typography variant="body2" sx={{ mt: 2 }}>
        Moves played: {currentStep} / {moves.length}
      </Typography>
    </div>
  );
}

export default ReviewRoom;
