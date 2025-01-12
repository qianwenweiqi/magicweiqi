// frontend/src/pages/GoGamePage.js
import React, { useState, useEffect, useRef } from "react";
import {
  Grid,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
} from "@mui/material";
import axios from "axios";
import GoBoard from "../components/GoBoard";
import { API_BASE_URL } from "../config/config";
import ScoringPanel from "../components/ScoringPanel";

function GoGamePage() {
  const [matchId, setMatchId] = useState(null);
  const [board, setBoard] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState("black");
  const [passes, setPasses] = useState(0);
  const [captured, setCaptured] = useState({ black: 0, white: 0 });
  const [historyLength, setHistoryLength] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);

  const [players, setPlayers] = useState([]);
  const [blackCards, setBlackCards] = useState([]);
  const [whiteCards, setWhiteCards] = useState([]);

  const [errorMessage, setErrorMessage] = useState("");
  const [resignMessage, setResignMessage] = useState("");

  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  const [blackTime, setBlackTime] = useState(300);
  const [whiteTime, setWhiteTime] = useState(300);
  const timerRef = useRef(null);

  const [confirmNewGameOpen, setConfirmNewGameOpen] = useState(false);
  const [confirmResignOpen, setConfirmResignOpen] = useState(false);

  const [sgfData, setSgfData] = useState("");
  const [username, setUsername] = useState("");

  // --- Scoring ---
  const [scoringMode, setScoringMode] = useState(false);
  const [scoringData, setScoringData] = useState({
    deadStones: [],
    territory: [],
    blackScore: 0,
    whiteScore: 0,
  });

  useEffect(() => {
    const localUser = localStorage.getItem("username") || "";
    setUsername(localUser);
    createMatch();
    // eslint-disable-next-line
  }, []);

  const createMatch = () => {
    const token = localStorage.getItem("token");
    axios
      .post(
        `${API_BASE_URL}/matches`,
        { board_size: 19 },
        {
          headers: { Authorization: `Bearer ${token}` },
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

        // Reset clocks
        setBlackTime(300);
        setWhiteTime(300);
      })
      .catch((err) => {
        console.error("Failed to create match:", err);
        setErrorMessage("Failed to create or load a match.");
      });
  };

  useEffect(() => {
    if (!matchId) return;
    const token = localStorage.getItem("token");
    axios
      .get(`${API_BASE_URL}/matches/${matchId}/players`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setPlayers(res.data.players || []);
        setBlackCards(res.data.black_cards || []);
        setWhiteCards(res.data.white_cards || []);
      })
      .catch((err) => {
        console.error("Failed to fetch player/cards:", err);
        setErrorMessage("Failed to load player data.");
      });
  }, [matchId]);

  useEffect(() => {
    // Timer
    if (gameOver || currentStep < history.length - 1 || scoringMode) {
      clearInterval(timerRef.current);
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (currentPlayer === "black") {
        setBlackTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGameOver(true);
            setWinner("White wins by time");
            return 0;
          }
          return prev - 1;
        });
      } else {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGameOver(true);
            setWinner("Black wins by time");
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentPlayer, gameOver, currentStep, history, scoringMode]);

  const handleMove = (x, y) => {
    if (gameOver) {
      setErrorMessage("Game is over.");
      return;
    }
    if (scoringMode) {
      markDeadStone(x, y);
      return;
    }
    if (currentStep < history.length - 1) {
      setErrorMessage("You are replaying history, cannot move now.");
      return;
    }
    if (!matchId) {
      setErrorMessage("Invalid match.");
      return;
    }
    const token = localStorage.getItem("token");
    axios
      .post(
        `${API_BASE_URL}/matches/${matchId}/move`,
        { x, y },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setPasses(res.data.passes);
        setCaptured(res.data.captured || { black: 0, white: 0 });
        setHistoryLength(res.data.history_length);
        setGameOver(res.data.game_over);
        setWinner(res.data.winner);
        setErrorMessage("");

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
        console.error("Error making move:", err);
        setErrorMessage(err.response?.data?.detail || "Failed to make a move.");
      });
  };

  const handlePass = () => {
    if (gameOver) {
      setErrorMessage("Game is over.");
      return;
    }
    if (scoringMode) {
      setErrorMessage("Cannot pass in scoring mode.");
      return;
    }
    if (currentStep < history.length - 1) {
      setErrorMessage("You are replaying history, cannot pass now.");
      return;
    }
    if (!matchId) {
      setErrorMessage("Invalid match.");
      return;
    }

    const token = localStorage.getItem("token");
    axios
      .post(
        `${API_BASE_URL}/matches/${matchId}/move`,
        { x: null, y: null },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        setBoard(res.data.board);
        setCurrentPlayer(res.data.current_player);
        setPasses(res.data.passes);
        setCaptured(res.data.captured || { black: 0, white: 0 });
        setHistoryLength(res.data.history_length);
        setGameOver(res.data.game_over);
        setWinner(res.data.winner);
        setErrorMessage("");

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

  const handleResign = () => {
    if (gameOver) {
      setErrorMessage("Game is over.");
      return;
    }
    if (scoringMode) {
      setErrorMessage("Cannot resign in scoring mode.");
      return;
    }
    if (currentStep < history.length - 1) {
      setErrorMessage("You are replaying history, cannot resign now.");
      return;
    }
    if (!matchId) {
      setErrorMessage("Invalid match.");
      return;
    }
    const token = localStorage.getItem("token");
    axios
      .post(
        `${API_BASE_URL}/matches/${matchId}/resign`,
        { player: currentPlayer },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        setBoard(res.data.board);
        setResignMessage(res.data.message);
        setPasses(res.data.passes);
        setCaptured(res.data.captured || { black: 0, white: 0 });
        setHistoryLength(res.data.history_length);
        setGameOver(res.data.game_over);
        setWinner(res.data.winner);
        setErrorMessage("");

        const newSnapshot = {
          board: res.data.board,
          currentPlayer,
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

  const handlePrev = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
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

  const handleRequestCounting = () => {
    if (gameOver) {
      setErrorMessage("Game is over.");
      return;
    }
    if (scoringMode) {
      setErrorMessage("Already in scoring mode.");
      return;
    }
    setScoringMode(true);
    setErrorMessage("");
  };

  const markDeadStone = (x, y) => {
    if (!matchId) return;
    const token = localStorage.getItem("token");
    axios
      .post(
        `${API_BASE_URL}/matches/${matchId}/mark_dead_stone`,
        { x, y },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        setScoringData(res.data.scoring_data);
      })
      .catch((err) => {
        console.error(err);
        setErrorMessage("Failed to mark dead stone.");
      });
  };

  const handleConfirmScoring = () => {
    if (!matchId) return;
    const token = localStorage.getItem("token");
    axios
      .post(`${API_BASE_URL}/matches/${matchId}/confirm_scoring`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.final_scored) {
          setScoringData({
            ...scoringData,
            blackScore: res.data.black_score,
            whiteScore: res.data.white_score,
          });
          setGameOver(true);
          setWinner(res.data.winner);
        }
      })
      .catch((err) => {
        console.error(err);
        setErrorMessage("Confirm scoring failed.");
      });
  };

  const handleCancelScoring = () => {
    setScoringMode(false);
    setErrorMessage("");
  };

  const handleRequestDraw = () => {
    alert("Request draw (not implemented yet)");
  };

  const handleExportSGF = async () => {
    if (!matchId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/matches/${matchId}/export_sgf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sgf = res.data.sgf;
      setSgfData(sgf);

      const blob = new Blob([sgf], { type: "application/x-go-sgf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `match_${matchId}.sgf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting SGF:", err);
      alert("Failed to export SGF");
    }
  };

  const handleConfirmNewGame = () => setConfirmNewGameOpen(true);
  const handleCloseNewGameDialog = () => setConfirmNewGameOpen(false);
  const handleNewGameOK = () => {
    setConfirmNewGameOpen(false);
    createMatch();
  };

  const handleConfirmResign = () => setConfirmResignOpen(true);
  const handleCloseResignDialog = () => setConfirmResignOpen(false);
  const handleResignOK = () => {
    setConfirmResignOpen(false);
    handleResign();
  };

  const blackPlayerData = players.find((p) => p.is_black) || {
    player_id: "UnknownBlack",
    elo: "??",
  };
  const whitePlayerData = players.find((p) => !p.is_black) || {
    player_id: "UnknownWhite",
    elo: "??",
  };

  return (
    /* 将外层padding去掉或改小，避免偏移棋盘 */
    <div style={{ margin: 10 }}>
      <Grid container spacing={2}>
        <Grid item xs={2}>
          <Paper style={{ padding: "8px", marginBottom: "8px" }}>
            <Typography variant="subtitle1" style={{ fontWeight: "bold" }}>
              Opponent (Black)
            </Typography>
            <Typography>Username: {blackPlayerData.player_id}</Typography>
            <Typography>ELO: {blackPlayerData.elo}</Typography>
            <Typography>Time: {blackTime}s</Typography>
            <Typography>Captured: {captured.black}</Typography>
            {blackCards.length > 0 && (
              <>
                <Typography variant="subtitle2" style={{ marginTop: 6 }}>
                  Black Cards
                </Typography>
                {blackCards.map((card) => (
                  <Paper
                    key={card.card_id}
                    style={{ padding: "4px", marginTop: "4px" }}
                    variant="outlined"
                  >
                    <Typography>
                      {card.name} (Cost: {card.cost})
                    </Typography>
                    <Typography variant="body2">{card.description}</Typography>
                  </Paper>
                ))}
              </>
            )}
          </Paper>
        </Grid>

        <Grid item xs={8}>
          <GoBoard
            boardSize={19}
            board={board}
            currentPlayer={currentPlayer}
            isReplaying={currentStep < history.length - 1 || gameOver}
            onCellClick={handleMove}
            showScoring={scoringMode}
            scoringData={scoringData}
          />

          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Button
              onClick={handlePrev}
              disabled={currentStep === 0}
              variant="outlined"
              style={{ margin: 4 }}
            >
              Prev
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentStep === history.length - 1}
              variant="outlined"
              style={{ margin: 4 }}
            >
              Next
            </Button>
            <Button onClick={handlePass} variant="outlined" style={{ margin: 4 }}>
              Pass
            </Button>
            <Button
              onClick={handleConfirmResign}
              variant="outlined"
              color="error"
              style={{ margin: 4 }}
            >
              Resign
            </Button>
            <Button
              onClick={handleRequestCounting}
              variant="outlined"
              style={{ margin: 4 }}
            >
              Request Counting
            </Button>
            <Button
              onClick={handleRequestDraw}
              variant="outlined"
              style={{ margin: 4 }}
            >
              Request Draw
            </Button>
            <Button
              onClick={handleExportSGF}
              variant="outlined"
              style={{ margin: 4 }}
              disabled={!gameOver}
            >
              Export SGF
            </Button>
            <Button
              onClick={handleConfirmNewGame}
              variant="outlined"
              color="secondary"
              style={{ margin: 4 }}
            >
              New Game
            </Button>
          </div>

          {scoringMode && (
            <ScoringPanel
              currentPlayer={currentPlayer}
              blackScore={scoringData.blackScore}
              whiteScore={scoringData.whiteScore}
              onConfirmScoring={handleConfirmScoring}
              onCancelScoring={handleCancelScoring}
            />
          )}
          {errorMessage && (
            <Typography color="error" style={{ marginTop: 8 }}>
              {errorMessage}
            </Typography>
          )}
          {resignMessage && (
            <Typography color="primary" style={{ marginTop: 8 }}>
              {resignMessage}
            </Typography>
          )}
          {winner && (
            <Typography color="primary" style={{ marginTop: 8 }}>
              Game Over: {winner}
            </Typography>
          )}
        </Grid>

        <Grid item xs={2}>
          <Paper style={{ padding: "8px", marginBottom: "8px" }}>
            <Typography variant="subtitle1" style={{ fontWeight: "bold" }}>
              Opponent (White)
            </Typography>
            <Typography>Username: {whitePlayerData.player_id}</Typography>
            <Typography>ELO: {whitePlayerData.elo}</Typography>
            <Typography>Time: {whiteTime}s</Typography>
            <Typography>Captured: {captured.white}</Typography>
            {whiteCards.length > 0 && (
              <>
                <Typography variant="subtitle2" style={{ marginTop: 6 }}>
                  White Cards
                </Typography>
                {whiteCards.map((card) => (
                  <Paper
                    key={card.card_id}
                    style={{ padding: "4px", marginTop: "4px" }}
                    variant="outlined"
                  >
                    <Typography>
                      {card.name} (Cost: {card.cost})
                    </Typography>
                    <Typography variant="body2">{card.description}</Typography>
                  </Paper>
                ))}
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={confirmNewGameOpen} onClose={handleCloseNewGameDialog}>
        <DialogTitle>Start a new game?</DialogTitle>
        <DialogActions>
          <Button onClick={handleCloseNewGameDialog}>Cancel</Button>
          <Button onClick={handleNewGameOK} color="secondary" variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmResignOpen} onClose={handleCloseResignDialog}>
        <DialogTitle>Confirm Resign?</DialogTitle>
        <DialogActions>
          <Button onClick={handleCloseResignDialog}>Cancel</Button>
          <Button onClick={handleResignOK} color="error" variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default GoGamePage;
