// frontend/src/pages/GoGamePage.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import GameControls from "../components/GameControls";
import { createMatch } from "../utils/matchUtils";
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
import PlayerPanel from "../components/PlayerPanel";
import { API_BASE_URL } from "../config/config";
import ScoringPanel from "../components/ScoringPanel";

function GoGamePage() {
  const navigate = useNavigate();
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

  const [blackTimer, setBlackTimer] = useState({
    main_time: 300,
    byo_yomi: 30,
    periods: 3
  });
  const [whiteTimer, setWhiteTimer] = useState({
    main_time: 300,
    byo_yomi: 30,
    periods: 3
  });
  const timerRef = useRef(null);

  const [confirmNewGameOpen, setConfirmNewGameOpen] = useState(false);
  const [confirmResignOpen, setConfirmResignOpen] = useState(false);

  const [sgfData, setSgfData] = useState("");
  const [username, setUsername] = useState("");

  // Scoring
  const [scoringMode, setScoringMode] = useState(false);
  const [scoringData, setScoringData] = useState({
    deadStones: [],
    territory: [],
    blackScore: 0,
    whiteScore: 0,
  });

  const [ws, setWs] = useState(null);

  const connectWebSocket = (mId) => {
    console.log('Connecting to game WebSocket...'); // Debug log
    
    // Connect to game WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = window.location.port === '3000' ? '8000' : window.location.port;
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/games/${mId}`;
    console.log('Connecting to WebSocket URL:', wsUrl); // Debug log
    
    const websocket = new WebSocket(wsUrl);
    
    
    websocket.onopen = () => {
      console.log('Game WebSocket connection established');
      setWs(websocket);
    };
    
    websocket.onmessage = (event) => {
      console.log('Received WebSocket message:', event.data); // Debug log
      const data = JSON.parse(event.data);
      if (data.type === 'game_update') {
        console.log('Applying game update:', data); // Debug log
        
        // Always update state with server data
        setBoard(data.board);
        setCurrentPlayer(data.current_player);
        setGameOver(data.game_over);
        setWinner(data.winner);
        setCaptured(data.captured || { black: 0, white: 0 });
        setPasses(data.passes || 0);
        
        // Update timers if provided
        if (data.black_timer) {
          setBlackTimer(data.black_timer);
        }
        if (data.white_timer) {
          setWhiteTimer(data.white_timer);
        }
        
        // Update history
        const newSnapshot = {
          board: data.board,
          currentPlayer: data.current_player,
          passes: data.passes || 0,
          captured: data.captured || { black: 0, white: 0 },
          historyLength: data.history_length,
          gameOver: data.game_over,
          winner: data.winner,
        };
        
        // Only add to history if it's a new state
        if (history.length === 0 || 
            JSON.stringify(history[history.length - 1].board) !== JSON.stringify(data.board)) {
          setHistory(prev => [...prev, newSnapshot]);
          setCurrentStep(prev => prev + 1);
        }
        
        // Clear any error messages on successful update
        setErrorMessage("");
      }
    };
    
    websocket.onerror = (error) => {
      console.error('Game WebSocket error:', error);
      // Try to reconnect
      setTimeout(() => connectWebSocket(mId), 3000);
    };
    
    websocket.onclose = () => {
      console.log('Game WebSocket connection closed');
      setWs(null);
      // Try to reconnect
      setTimeout(() => connectWebSocket(mId), 3000);
    };
    
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  };

  useEffect(() => {
    const localUser = localStorage.getItem("username") || "";
    setUsername(localUser);
    
    const pathMatch = window.location.pathname.match(/\/game\/([^/]+)/);
    if (pathMatch && pathMatch[1]) {
      const mId = pathMatch[1];
      setMatchId(mId);
      loadMatch(mId);
      const cleanup = connectWebSocket(mId);
      return cleanup;
    } else {
      window.location.href = '/lobby';
    }
    // eslint-disable-next-line
  }, []);

  const loadMatch = async (mId) => {
    console.log(`Attempting to load match with id: ${mId}`);  // Debug log
    const token = localStorage.getItem("token");
    axios
      .get(`${API_BASE_URL}/matches/${mId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        console.log('Successfully loaded match data:', res.data);  // Debug log
        setMatchId(mId);
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

        setBlackTimer(res.data.black_timer || {
          main_time: 300,
          byo_yomi: 30,
          periods: 3
        });
        setWhiteTimer(res.data.white_timer || {
          main_time: 300,
          byo_yomi: 30,
          periods: 3
        });
      })
      .catch((err) => {
        console.error("Failed to load match:", err);
        setErrorMessage("Failed to load match. Please return to lobby.");
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

  // 当游戏结束后，可向后端更新状态
  useEffect(() => {
    if (gameOver && matchId) {
      const token = localStorage.getItem("token");
      axios
        .post(`${API_BASE_URL}/matches/${matchId}/update_status`, {
          status: "completed"
        }, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch((err) => {
          console.error("Failed to update lobby status:", err);
        });
    }
  }, [gameOver, matchId]);

  // 本地计时器，仅为视觉演示
  useEffect(() => {
    if (gameOver || currentStep < history.length - 1 || scoringMode) {
      clearInterval(timerRef.current);
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (currentPlayer === "black") {
        setBlackTimer((prev) => {
          const newTimer = { ...prev };
          if (newTimer.main_time > 0) {
            newTimer.main_time = Math.max(0, newTimer.main_time - 1);
          } else if (newTimer.byo_yomi > 0) {
            newTimer.byo_yomi = Math.max(0, newTimer.byo_yomi - 1);
            if (newTimer.byo_yomi === 0 && newTimer.periods > 0) {
              newTimer.periods--;
              newTimer.byo_yomi = 30;
            }
          }
          if (newTimer.main_time === 0 && newTimer.byo_yomi === 0 && newTimer.periods === 0) {
            clearInterval(timerRef.current);
            setGameOver(true);
            setWinner("White wins by time");
          }
          return newTimer;
        });
      } else {
        setWhiteTimer((prev) => {
          const newTimer = { ...prev };
          if (newTimer.main_time > 0) {
            newTimer.main_time = Math.max(0, newTimer.main_time - 1);
          } else if (newTimer.byo_yomi > 0) {
            newTimer.byo_yomi = Math.max(0, newTimer.byo_yomi - 1);
            if (newTimer.byo_yomi === 0 && newTimer.periods > 0) {
              newTimer.periods--;
              newTimer.byo_yomi = 30;
            }
          }
          if (newTimer.main_time === 0 && newTimer.byo_yomi === 0 && newTimer.periods === 0) {
            clearInterval(timerRef.current);
            setGameOver(true);
            setWinner("Black wins by time");
          }
          return newTimer;
        });
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentPlayer, gameOver, currentStep, history, scoringMode]);

  const handleMove = async (x, y) => {
    if (gameOver) {
      setErrorMessage("Game is over.");
      return;
    }
    if (scoringMode) {
      markDeadStone(x, y);
      return;
    }
    if (currentStep < history.length - 1) {
      setErrorMessage("You're in replay history mode, cannot move now.");
      return;
    }
    if (!matchId) {
      setErrorMessage("Invalid match.");
      return;
    }
    // Verify it's the player's turn
    const blackPlayer = players.find(p => p.is_black)?.player_id;
    const whitePlayer = players.find(p => !p.is_black)?.player_id;
    
    if ((currentPlayer === "black" && username !== blackPlayer) ||
        (currentPlayer === "white" && username !== whitePlayer)) {
      setErrorMessage("Not your turn");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/matches/${matchId}/move`,
        { x, y },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update history
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
      setErrorMessage("");
    } catch (err) {
      console.error("Error making move:", err);
      setErrorMessage(err.response?.data?.detail || "Failed to make a move.");
    }
  };

  const handlePass = async () => {
    if (gameOver) {
      setErrorMessage("Game is over.");
      return;
    }
    if (scoringMode) {
      setErrorMessage("Cannot pass in scoring mode.");
      return;
    }
    if (currentStep < history.length - 1) {
      setErrorMessage("Replaying history, can't pass now.");
      return;
    }
    if (!matchId) {
      setErrorMessage("Invalid match.");
      return;
    }

    // Verify it's the player's turn
    const blackPlayer = players.find(p => p.is_black)?.player_id;
    const whitePlayer = players.find(p => !p.is_black)?.player_id;
    
    if ((currentPlayer === "black" && username !== blackPlayer) ||
        (currentPlayer === "white" && username !== whitePlayer)) {
      setErrorMessage("Not your turn");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/matches/${matchId}/move`,
        { x: null, y: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update history
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
      setErrorMessage("");
    } catch (err) {
      console.error("Error passing:", err);
      setErrorMessage(err.response?.data?.detail || "Failed to pass.");
    }
  };

  const handleResign = async () => {
    if (gameOver) {
      setErrorMessage("Game is over.");
      return;
    }
    if (scoringMode) {
      setErrorMessage("Cannot resign in scoring mode.");
      return;
    }
    if (currentStep < history.length - 1) {
      setErrorMessage("In replay mode, cannot resign now.");
      return;
    }
    if (!matchId) {
      setErrorMessage("Invalid match.");
      return;
    }

    // Verify it's the player's turn
    const blackPlayer = players.find(p => p.is_black)?.player_id;
    const whitePlayer = players.find(p => !p.is_black)?.player_id;
    
    if ((currentPlayer === "black" && username !== blackPlayer) ||
        (currentPlayer === "white" && username !== whitePlayer)) {
      setErrorMessage("Not your turn");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/matches/${matchId}/resign`,
        { player: currentPlayer },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setBoard(res.data.board);
      setResignMessage(res.data.message);
      setPasses(res.data.passes);
      setCaptured(res.data.captured || { black: 0, white: 0 });
      setHistoryLength(res.data.history_length);
      setGameOver(res.data.game_over);
      setWinner(res.data.winner);
      setErrorMessage("");

      // Update history
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
    } catch (err) {
      console.error("Error resigning:", err);
      setErrorMessage(err.response?.data?.detail || "Failed to resign.");
    }
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

  const markDeadStone = async (x, y) => {
    if (!matchId) return;

    // Verify it's a player in the game
    const blackPlayer = players.find(p => p.is_black)?.player_id;
    const whitePlayer = players.find(p => !p.is_black)?.player_id;
    if (username !== blackPlayer && username !== whitePlayer) {
      setErrorMessage("Only players can mark dead stones");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/matches/${matchId}/mark_dead_stone`,
        { x, y },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setScoringData(res.data.scoring_data);
      setErrorMessage("");
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to mark dead stone.");
    }
  };

  const handleConfirmScoring = async () => {
    if (!matchId) return;

    // Verify it's a player in the game
    const blackPlayer = players.find(p => p.is_black)?.player_id;
    const whitePlayer = players.find(p => !p.is_black)?.player_id;
    if (username !== blackPlayer && username !== whitePlayer) {
      setErrorMessage("Only players can confirm scoring");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await axios.post(
        `${API_BASE_URL}/matches/${matchId}/confirm_scoring`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.final_scored) {
        setScoringData({
          ...scoringData,
          blackScore: res.data.black_score,
          whiteScore: res.data.white_score,
        });
        setGameOver(true);
        setWinner(res.data.winner);
      }
      setErrorMessage("");
    } catch (err) {
      console.error(err);
      setErrorMessage("Confirm scoring failed.");
    }
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
  const handleNewGameOK = async () => {
    setConfirmNewGameOpen(false);
    try {
      const config = {
        eloMin: 0,
        eloMax: 9999,
        whoIsBlack: "random",
        timeRule: "absolute",
        mainTime: 300,
        byoYomiPeriods: 3,
        byoYomiTime: 30,
        boardSize: 19,
        handicap: 0,
      };
      const roomId = await createMatch(config);
      navigate(`/game/${roomId}`);
    } catch (error) {
      console.error('Error creating new game:', error);
      setErrorMessage('Failed to create new game');
    }
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
    <div style={{ margin: 10 }}>
      <Grid container spacing={2}>
        <Grid item xs={2}>
          <PlayerPanel 
            playerData={blackPlayerData}
            timer={blackTimer}
            captured={captured.black}
            cards={blackCards}
            color="Black"
          />
        </Grid>

        <Grid item xs={8}>
          <GoBoard
            boardSize={19}
            board={board}
            currentPlayer={currentPlayer}
            isReplaying={currentStep < history.length - 1 || gameOver}
            onCellClick={handleMove}
          />

          <GameControls
            onPass={handlePass}
            onResign={handleConfirmResign}
            onRequestCounting={handleRequestCounting}
            onRequestDraw={handleRequestDraw}
            onExportSGF={handleExportSGF}
            onNewGame={handleConfirmNewGame}
            onPrev={handlePrev}
            onNext={handleNext}
            gameOver={gameOver}
            currentStep={currentStep}
            historyLength={history.length}
          />

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
            <div>
              <Typography color="error" style={{ marginTop: 8 }}>
                {errorMessage}
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                style={{ marginTop: 8 }}
                onClick={() => window.location.href = '/lobby'}
              >
                Return to Lobby
              </Button>
            </div>
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
          <PlayerPanel 
            playerData={whitePlayerData}
            timer={whiteTimer}
            captured={captured.white}
            cards={whiteCards}
            color="White"
          />
        </Grid>
      </Grid>

      {/* New game confirm */}
      <Dialog open={confirmNewGameOpen} onClose={handleCloseNewGameDialog}>
        <DialogTitle>Start a new game?</DialogTitle>
        <DialogActions>
          <Button onClick={handleCloseNewGameDialog}>Cancel</Button>
          <Button onClick={handleNewGameOK} color="secondary" variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Resign confirm */}
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
