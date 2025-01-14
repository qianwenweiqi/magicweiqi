// frontend/src/pages/ReviewRoom.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Button, Typography } from "@mui/material";
import GoBoard from "../components/GoBoard";
import { API_BASE_URL } from "../config/config";
import axios from "axios";

function ReviewRoom() {
  const boardSize = 19;
  const emptyBoard = Array.from({ length: boardSize }, () =>
    Array(boardSize).fill(null)
  );

  const [moves, setMoves] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [board, setBoard] = useState(emptyBoard);
  const [error, setError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  const [scoringMode, setScoringMode] = useState(false);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => (prev < moves.length ? prev + 1 : prev));
  }, [moves.length]);

  useEffect(() => {
    renderBoard();
  }, [currentStep]);

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
        setBoard(emptyBoard);
        return;
      } catch (err) {
        console.error("Failed to parse cached data:", err);
        // If parsing fails, continue with API call
      }
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      // 修正：带上 /api/v1
      const res = await axios.post(`${API_BASE_URL}/api/v1/review_sgf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const movesData = res.data.moves;
      // Store the moves data in localStorage
      localStorage.setItem(`sgf_${file.name}`, JSON.stringify(movesData));
      setMoves(movesData);
      setCurrentStep(0);
      setBoard(emptyBoard);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to parse SGF");
    }
  };

  const renderBoard = () => {
    const newBoard = emptyBoard.map((row) => [...row]);
    for (let i = 0; i < currentStep; i++) {
      const { color, x, y } = moves[i];
      if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        newBoard[x][y] = color;
      }
    }
    setBoard(newBoard);
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
