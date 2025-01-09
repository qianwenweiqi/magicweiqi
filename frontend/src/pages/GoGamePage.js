import React, { useState, useEffect } from "react";
import { Grid, Paper, Typography, Avatar, Button } from "@mui/material";
import axios from "axios";
import GoBoard from "../components/GoBoard";

function GoGamePage() {
  const [matchId, setMatchId] = useState(null);
  const [board, setBoard] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState("black");
  // Debug info from server:
  const [passes, setPasses] = useState(0);
  const [captured, setCaptured] = useState({ black: 0, white: 0 });
  const [historyLength, setHistoryLength] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);

  // For players + cards
  const [players, setPlayers] = useState([]);
  const [blackCards, setBlackCards] = useState([]);
  const [whiteCards, setWhiteCards] = useState([]);

  // For local errors / messages
  const [errorMessage, setErrorMessage] = useState("");
  const [resignMessage, setResignMessage] = useState("");

  // Local replay history
  // Each "snapshot" = { board, currentPlayer, passes, captured, message?, etc. }
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  // --------------------
  // 1) Create or load a match
  // --------------------
  useEffect(() => {
    createMatch();
    // eslint-disable-next-line
  }, []);

  const createMatch = () => {
    const token = localStorage.getItem("token");
    axios
      .post(
        "http://127.0.0.1:8000/api/v1/matches",
        { board_size: 19 },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then((res) => {
        setMatchId(res.data.match_id);
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setPasses(res.data.passes);
        setCaptured(res.data.captured || { black: 0, white: 0 });
        setHistoryLength(res.data.history_length);
        setGameOver(res.data.game_over);
        setWinner(res.data.winner);

        // Initialize local history with the starting position
        const firstSnapshot = {
          board: res.data.board,
          currentPlayer: res.data.current_player,
          passes: res.data.passes,
          captured: res.data.captured || { black: 0, white: 0 },
          historyLength: res.data.history_length,
          gameOver: res.data.game_over,
          winner: res.data.winner,
        };
        setHistory([firstSnapshot]);
        setCurrentStep(0);
      })
      .catch((err) => {
        console.error("Failed to create match:", err);
        setErrorMessage("Failed to create or load a match.");
      });
  };

  // --------------------
  // 2) After we have matchId, fetch players + cards
  // --------------------
  useEffect(() => {
    if (!matchId) return;
    const token = localStorage.getItem("token");
    axios
      .get(`http://127.0.0.1:8000/api/v1/matches/${matchId}/players`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setPlayers(res.data.players || []);
        setBlackCards(res.data.black_cards || []);
        setWhiteCards(res.data.white_cards || []);
        setErrorMessage("");
      })
      .catch((err) => {
        console.error("Failed to fetch player/cards:", err);
        setErrorMessage("Failed to load player data.");
      });
  }, [matchId]);

  // --------------------
  // 3) Handle moves (click intersections)
  // --------------------
  const handleMove = (x, y) => {
    if (currentStep < history.length - 1) {
      // We are in "replay" mode, can't place new moves
      setErrorMessage("You are replaying history, cannot place moves now.");
      return;
    }
    if (!matchId || gameOver) {
      setErrorMessage("Game is over or invalid match.");
      return;
    }
    const token = localStorage.getItem("token");
    axios
      .post(
        `http://127.0.0.1:8000/api/v1/matches/${matchId}/move`,
        { x, y },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then((res) => {
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setErrorMessage("");
        setPasses(res.data.passes);
        setCaptured(res.data.captured || { black: 0, white: 0 });
        setHistoryLength(res.data.history_length);
        setGameOver(res.data.game_over);
        setWinner(res.data.winner);

        // Add this new snapshot to local history
        const newSnapshot = {
          board: res.data.board,
          currentPlayer: res.data.current_player,
          passes: res.data.passes,
          captured: res.data.captured || { black: 0, white: 0 },
          historyLength: res.data.history_length,
          gameOver: res.data.game_over,
          winner: res.data.winner,
        };
        const newHistory = [...history.slice(0, currentStep + 1), newSnapshot];
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);
        setResignMessage("");
      })
      .catch((err) => {
        console.error("Error making a move:", err);
        setErrorMessage(err.response?.data?.detail || "Failed to make a move.");
      });
  };

  // --------------------
  // 4) Pass
  // --------------------
  const handlePass = () => {
    if (currentStep < history.length - 1) {
      setErrorMessage("You are replaying history, cannot pass now.");
      return;
    }
    if (!matchId || gameOver) {
      setErrorMessage("Game is over or invalid match.");
      return;
    }
    const token = localStorage.getItem("token");
    axios
      .post(
        `http://127.0.0.1:8000/api/v1/matches/${matchId}/move`,
        { x: null, y: null },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then((res) => {
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setErrorMessage("");
        setPasses(res.data.passes);
        setCaptured(res.data.captured || { black: 0, white: 0 });
        setHistoryLength(res.data.history_length);
        setGameOver(res.data.game_over);
        setWinner(res.data.winner);

        const newSnapshot = {
          board: res.data.board,
          currentPlayer: res.data.current_player,
          passes: res.data.passes,
          captured: res.data.captured || { black: 0, white: 0 },
          historyLength: res.data.history_length,
          gameOver: res.data.game_over,
          winner: res.data.winner,
        };
        const newHistory = [...history.slice(0, currentStep + 1), newSnapshot];
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);
        setResignMessage("");
      })
      .catch((err) => {
        console.error("Error passing:", err);
        setErrorMessage(err.response?.data?.detail || "Failed to pass.");
      });
  };

  // --------------------
  // 5) Resign
  // --------------------
  const handleResign = () => {
    if (currentStep < history.length - 1) {
      setErrorMessage("You are replaying history, cannot resign now.");
      return;
    }
    if (!matchId || gameOver) {
      setErrorMessage("Game is over or invalid match.");
      return;
    }
    const token = localStorage.getItem("token");
    axios
      .post(
        `http://127.0.0.1:8000/api/v1/matches/${matchId}/resign`,
        { player: currentPlayer },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then((res) => {
        setBoard(res.data.board);
        setResignMessage(res.data.message);
        setErrorMessage("");
        setPasses(res.data.passes);
        setCaptured(res.data.captured || { black: 0, white: 0 });
        setHistoryLength(res.data.history_length);
        setGameOver(res.data.game_over);
        setWinner(res.data.winner);

        const newSnapshot = {
          board: res.data.board,
          currentPlayer, // doesn't matter now
          passes: res.data.passes,
          captured: res.data.captured || { black: 0, white: 0 },
          historyLength: res.data.history_length,
          gameOver: res.data.game_over,
          winner: res.data.winner,
        };
        const newHistory = [...history.slice(0, currentStep + 1), newSnapshot];
        setHistory(newHistory);
        setCurrentStep(newHistory.length - 1);
      })
      .catch((err) => {
        console.error("Error resigning:", err);
        setErrorMessage(err.response?.data?.detail || "Failed to resign.");
      });
  };

  // --------------------
  // 6) Replay: Prev / Next
  // --------------------
  const handlePrev = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      // Show the old snapshot
      const snap = history[newStep];
      setBoard(snap.board);
      setCurrentPlayer(snap.currentPlayer);
      setPasses(snap.passes);
      setCaptured(snap.captured || { black: 0, white: 0 });
      setHistoryLength(snap.historyLength);
      setGameOver(snap.gameOver);
      setWinner(snap.winner);

      setErrorMessage("");
      setResignMessage("");
    }
  };

  const handleNext = () => {
    if (currentStep < history.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      const snap = history[newStep];
      setBoard(snap.board);
      setCurrentPlayer(snap.currentPlayer);
      setPasses(snap.passes);
      setCaptured(snap.captured || { black: 0, white: 0 });
      setHistoryLength(snap.historyLength);
      setGameOver(snap.gameOver);
      setWinner(snap.winner);
      setErrorMessage("");
      setResignMessage("");
    }
  };

  // Identify black/white players (dummy logic)
  const blackPlayer = players.find((p) => p.player_id === "black") || {
    player_id: "Black ???",
    elo: "N/A",
    avatar_url: "",
  };
  const whitePlayer = players.find((p) => p.player_id === "white") || {
    player_id: "White ???",
    elo: "N/A",
    avatar_url: "",
  };

  return (
    <Grid container spacing={2} style={{ padding: 16 }}>
      <Grid item xs={12} md={8}>
        {/* GoBoard is purely presentational: local timers, star points, etc. */}
        <GoBoard
          boardSize={19}
          board={board}
          currentPlayer={currentPlayer}
          // Freeze timers if in replay or if game is over:
          isReplaying={currentStep < history.length - 1 || gameOver}
          onCellClick={handleMove}
        />

        {/* Replay buttons below board */}
        <div style={{ marginTop: 16 }}>
          <Button onClick={handlePrev} disabled={currentStep === 0}>
            Prev
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentStep === history.length - 1}
          >
            Next
          </Button>
        </div>
      </Grid>

      <Grid item xs={12} md={4}>
        <Paper style={{ padding: 16, marginBottom: 16 }}>
          <Typography variant="h5" gutterBottom>
            Match Info
          </Typography>
          {errorMessage && <Typography color="error">{errorMessage}</Typography>}
          {resignMessage && (
            <Typography color="primary">{resignMessage}</Typography>
          )}
          <Typography>Match ID: {matchId || "N/A"}</Typography>
          <Typography>Game Over: {String(gameOver)}</Typography>
          {winner && <Typography>Winner: {winner}</Typography>}
          <hr />
          <Typography variant="h6">Black Player</Typography>
          <Avatar src={blackPlayer.avatar_url} />
          <Typography>ID: {blackPlayer.player_id}</Typography>
          <Typography>ELO: {blackPlayer.elo}</Typography>
          {blackCards?.length > 0 && (
            <>
              <Typography>Cards:</Typography>
              {blackCards.map((card) => (
                <Paper
                  key={card.card_id}
                  variant="outlined"
                  style={{ padding: 8, margin: "4px 0" }}
                >
                  <Typography variant="subtitle1">
                    {card.name} (Cost: {card.cost})
                  </Typography>
                  <Typography variant="body2">{card.description}</Typography>
                </Paper>
              ))}
            </>
          )}
          <hr />
          <Typography variant="h6">White Player</Typography>
          <Avatar src={whitePlayer.avatar_url} />
          <Typography>ID: {whitePlayer.player_id}</Typography>
          <Typography>ELO: {whitePlayer.elo}</Typography>
          {whiteCards?.length > 0 && (
            <>
              <Typography>Cards:</Typography>
              {whiteCards.map((card) => (
                <Paper
                  key={card.card_id}
                  variant="outlined"
                  style={{ padding: 8, margin: "4px 0" }}
                >
                  <Typography variant="subtitle1">
                    {card.name} (Cost: {card.cost})
                  </Typography>
                  <Typography variant="body2">{card.description}</Typography>
                </Paper>
              ))}
            </>
          )}
        </Paper>

        {/* Debug Info */}
        <Paper style={{ padding: 16, marginBottom: 16 }}>
          <Typography variant="h6">Debug Info</Typography>
          <Typography>
            History Step: {currentStep + 1} / {history.length}
          </Typography>
          <Typography>Passes: {passes}</Typography>
          <Typography>
            Captured: Black {captured.black}, White {captured.white}
          </Typography>
          <Typography>History length (server): {historyLength}</Typography>
        </Paper>

        {/* Action Buttons */}
        <Paper style={{ padding: 16 }}>
          <Typography variant="h6">Actions</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handlePass}
            style={{ marginRight: 8 }}
          >
            Pass
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleResign}
            style={{ marginRight: 8 }}
          >
            Resign
          </Button>
          <Button variant="contained" onClick={createMatch}>
            New Game
          </Button>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default GoGamePage;
