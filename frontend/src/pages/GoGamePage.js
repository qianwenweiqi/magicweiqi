// frontend/src/pages/GoGamePage.js
import React, { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Grid, Paper, Typography, Button, Dialog, DialogTitle, DialogActions } from "@mui/material";
import axios from "axios";
import { useGame } from "../context/GameContext";
import { useAuth } from "../context/AuthContext";
import GameControls from "../components/GameControls";
import GoBoard from "../components/GoBoard";
import PlayerPanel from "../components/PlayerPanel";
import ScoringPanel from "../components/ScoringPanel";
import { API_BASE_URL } from "../config/config";
import socketClient from "../services/socketClient";

function GoGamePage() {
  const navigate = useNavigate();
  const { state: gameState, dispatch: gameDispatch } = useGame();
  const { user } = useAuth();
  const timerRef = useRef(null);

  const {
    matchId,
    board,
    currentPlayer,
    passes,
    captured,
    history,
    currentStep,
    gameOver,
    winner,
    players,
    blackCards,
    whiteCards,
    errorMessage,
    resignMessage,
    blackTimer,
    whiteTimer,
    confirmNewGameOpen,
    confirmResignOpen,
    sgfData,
    scoringMode,
    scoringData
  } = gameState;

  const username = user?.username || "";

  const connectWebSocket = (mId) => {
    console.log('[GoGamePage] Connecting to game WebSocket for match:', mId);
    
    const socket = socketClient.connectToGame(mId);
    if (!socket) {
      console.error('[GoGamePage] Failed to create socket connection');
      return () => {};
    }
    
    const handlers = [
      socketClient.on('game_update', (data) => {
        console.log('[GoGamePage] Received game_update:', data);
        if (data.match_id === mId) {
          gameDispatch({ type: 'UPDATE_GAME', payload: data });
        }
      }),
      
      socketClient.on('connect', () => {
        console.log('[GoGamePage] Socket connected successfully');
      }),
      
      socketClient.on('disconnect', (reason) => {
        console.log('[GoGamePage] Socket disconnected:', reason);
      }),
      
      socketClient.on('error', (error) => {
        console.error('[GoGamePage] Socket error:', error);
        gameDispatch({ 
          type: 'SET_ERROR', 
          payload: "Lost connection to game server. Please refresh the page." 
        });
      }),
      
      socketClient.on('maxReconnectAttemptsReached', () => {
        console.error('[GoGamePage] Max reconnect attempts reached');
        gameDispatch({ 
          type: 'SET_ERROR', 
          payload: "Unable to reconnect to game server. Please return to lobby." 
        });
      })
    ];
    
    return () => {
      console.log('[GoGamePage] Cleaning up socket connection');
      handlers.forEach(cleanup => cleanup());
      // 只断开当前游戏的socket连接
      socketClient.disconnect(mId);
    };
  };

  useEffect(() => {
    const pathMatch = window.location.pathname.match(/\/game\/([^/]+)/);
    if (pathMatch && pathMatch[1]) {
      const mId = pathMatch[1];
      gameDispatch({ type: 'SET_MATCH_ID', payload: mId });
      loadMatch(mId);
      const cleanup = connectWebSocket(mId);
      return cleanup;
    } else {
      window.location.href = '/lobby';
    }
  }, [gameDispatch]);

  const loadMatch = async (mId) => {
    const token = localStorage.getItem("token");
    try {
      // 修正：带上 /api/v1
      const res = await axios.get(`${API_BASE_URL}/api/v1/matches/${mId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      gameDispatch({ type: 'LOAD_MATCH', payload: res.data });
    } catch (err) {
      console.error("Failed to load match:", err);
      gameDispatch({ type: 'SET_ERROR', payload: "Failed to load match. Please return to lobby." });
    }
  };

  useEffect(() => {
    if (!matchId) return;
    const token = localStorage.getItem("token");
    // 修正：带上 /api/v1
    axios.get(`${API_BASE_URL}/api/v1/matches/${matchId}/players`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((res) => {
      gameDispatch({ type: 'SET_PLAYERS', payload: res.data });
    })
    .catch((err) => {
      console.error("Failed to fetch player/cards:", err);
      gameDispatch({ type: 'SET_ERROR', payload: "Failed to load player data." });
    });
  }, [matchId, gameDispatch]);

  // Timer logic
  useEffect(() => {
    if (gameOver || currentStep < history.length - 1 || scoringMode) {
      clearInterval(timerRef.current);
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      gameDispatch({ type: 'UPDATE_TIMER' });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentPlayer, gameOver, currentStep, history, scoringMode, gameDispatch]);

  const handleMove = async (x, y) => {
    if (gameOver || scoringMode || currentStep < history.length - 1 || !matchId) {
      gameDispatch({ type: 'SET_ERROR', payload: "Invalid move attempt" });
      return;
    }

    const token = localStorage.getItem("token");
    try {
      // 修正：带上 /api/v1
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/matches/${matchId}/move`,
        { x, y },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      gameDispatch({ type: 'UPDATE_GAME', payload: res.data });
    } catch (err) {
      console.error("Error making move:", err);
      gameDispatch({ type: 'SET_ERROR', payload: err.response?.data?.detail || "Failed to make a move." });
    }
  };

  // Other game actions (pass, resign, etc.) would follow similar patterns...

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
            onPass={() => gameDispatch({ type: 'PASS' })}
            onResign={() => gameDispatch({ type: 'SET_CONFIRM_RESIGN_OPEN', payload: true })}
            onRequestCounting={() => gameDispatch({ type: 'SET_SCORING_MODE', payload: true })}
            onRequestDraw={() => alert("Request draw (not implemented yet)")}
            onExportSGF={() => gameDispatch({ type: 'EXPORT_SGF' })}
            onNewGame={() => gameDispatch({ type: 'SET_CONFIRM_NEW_GAME_OPEN', payload: true })}
            onPrev={() => gameDispatch({ type: 'PREV_STEP' })}
            onNext={() => gameDispatch({ type: 'NEXT_STEP' })}
            gameOver={gameOver}
            currentStep={currentStep}
            historyLength={history.length}
          />

          {scoringMode && (
            <ScoringPanel
              currentPlayer={currentPlayer}
              blackScore={scoringData.blackScore}
              whiteScore={scoringData.whiteScore}
              onConfirmScoring={() => gameDispatch({ type: 'CONFIRM_SCORING' })}
              onCancelScoring={() => gameDispatch({ type: 'SET_SCORING_MODE', payload: false })}
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

      {/* Dialogs and other UI elements */}
    </div>
  );
}

export default GoGamePage;
