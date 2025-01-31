import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Grid, Paper, Typography, Button } from "@mui/material";
import axios from "axios";
import { useGame } from "../context/GameContext";
import { useAuth } from "../context/AuthContext";
import GameControls from "../components/GameControls";
import GoBoard from "../components/GoBoard";
import PlayerPanel from "../components/PlayerPanel";
import ScoringPanel from "../components/ScoringPanel";
import ResignConfirmModal from "../components/ResignConfirmModal";
import { API_BASE_URL } from "../config/config";
import socketClient from "../services/socketClient";

/**
 * GoGamePage:
 * - 从URL获取 matchId => dispatch('SET_MATCH_ID')
 * - 拉取后端对局初始信息 => dispatch('LOAD_MATCH')
 * - 拉取玩家信息 => dispatch('SET_PLAYERS')
 * - 显示棋盘(GoBoard)，控制按钮(GameControls)，计分面板(ScoringPanel)等
 * - 不再在此处 setInterval，计时器仅在 GameContext
 */

function GoGamePage() {
  const navigate = useNavigate();
  const { state: gameState, dispatch: gameDispatch, handleMove } = useGame();
  const { user } = useAuth();

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
    scoringData,
  } = gameState;

  const username = user?.username || "";

  // 从 URL 提取 matchId，并加载对局信息
  useEffect(() => {
    const pathMatch = window.location.pathname.match(/\/game\/([^/]+)/);
    if (pathMatch && pathMatch[1]) {
      const mId = pathMatch[1];
      console.log("[GoGamePage] Found matchId:", mId);
      
      // 先设置matchId，这会触发GameContext中的WebSocket连接
      gameDispatch({ type: "SET_MATCH_ID", payload: mId });
      
      // 等待WebSocket连接建立
      const ensureConnection = async () => {
        try {
          console.log("[GoGamePage] Ensuring WebSocket connection for match:", mId);
          const socket = await socketClient.connectToGame(mId);
          if (socket) {
            console.log("[GoGamePage] WebSocket connection established");
            // WebSocket连接成功后加载对局数据
            await loadMatch(mId);
          } else {
            console.error("[GoGamePage] Failed to establish WebSocket connection");
            gameDispatch({
              type: "SET_ERROR",
              payload: "Failed to connect to game server. Please try again.",
            });
          }
        } catch (err) {
          console.error("[GoGamePage] Connection error:", err);
          gameDispatch({
            type: "SET_ERROR",
            payload: "Connection error. Please return to lobby and try again.",
          });
        }
      };
      
      ensureConnection().catch(err => {
        console.error("[GoGamePage] Setup error:", err);
        gameDispatch({
          type: "SET_ERROR",
          payload: "Failed to setup game. Please try again.",
        });
      });
    } else {
      console.error("[GoGamePage] No matchId => redirect /lobby");
      navigate("/lobby");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载 match 详情(棋盘、计时、已落子等)
  const loadMatch = async (mId) => {
    const token = localStorage.getItem("token");
    try {
      console.log("[GoGamePage] loadMatch => /api/v1/matches/" + mId);
      const res = await axios.get(`${API_BASE_URL}/api/v1/matches/${mId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("[GoGamePage] loadMatch => response:", res.data);
      gameDispatch({ type: "LOAD_MATCH", payload: res.data });
    } catch (err) {
      console.error("[GoGamePage] Failed to load match:", err);
      gameDispatch({
        type: "SET_ERROR",
        payload: "Failed to load match. Please return to lobby.",
      });
    }
  };

  // 拉取玩家信息
  useEffect(() => {
    if (!matchId) return;
    const token = localStorage.getItem("token");
    const fetchPlayers = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/v1/matches/${matchId}/players`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("[GoGamePage] fetchPlayers =>", res.data);
        gameDispatch({ type: "SET_PLAYERS", payload: res.data });
      } catch (err) {
        console.error("[GoGamePage] fetchPlayers error:", err);
        gameDispatch({ type: "SET_ERROR", payload: "Failed to load player data." });
      }
    };
    fetchPlayers();
  }, [matchId, gameDispatch]);

  // 点击棋盘 => 执行落子/标记死子
  const onCellClick = (x, y) => {
    console.log("[GoGamePage] onCellClick =>", x, y);
    if (currentStep < history.length - 1 || gameOver) {
      console.warn("[GoGamePage] onCellClick => in replay or gameOver, skip");
      return;
    }
    if (!matchId) {
      console.error("[GoGamePage] No matchId => skip onCellClick");
      return;
    }
    if (scoringMode) {
      console.log(`[GoGamePage] Mark dead stone => x=${x}, y=${y}`);
      socketClient.sendGameAction(matchId, "mark_dead_stone", { x, y });
    } else {
      // 正常对局落子
      console.log("[GoGamePage] Calling handleMove =>", x, y);
      handleMove(x, y);
    }
  };

  // 找到黑白双方信息
  const blackPlayerData =
    players.find((p) => p.is_black) || { player_id: "UnknownBlack", elo: "??" };
  const whitePlayerData =
    players.find((p) => !p.is_black) || { player_id: "UnknownWhite", elo: "??" };

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
            // 注意: x,y => top => x*30, left => y*30
            // 这里和数组 board[x][y] 一致; x表行/纵, y表列/横
            isReplaying={currentStep < history.length - 1 || gameOver}
            onCellClick={onCellClick}
          />

          <div style={{ marginTop: 8 }}>
            <Typography variant="body2" color="textSecondary">
              Current Step: {currentStep} / {history.length - 1}
            </Typography>
          </div>

          <GameControls
            onPass={() => {
              console.log("[GoGamePage] Pass => game_update pass");
              socketClient.sendGameAction(matchId, "pass");
            }}
            onResign={() => {
              console.log("[GoGamePage] Opening resign confirmation modal");
              gameDispatch({ type: "SET_CONFIRM_RESIGN_OPEN", payload: true });
            }}
            onRequestCounting={() => {
              console.log("[GoGamePage] confirm_scoring => scoringMode");
              socketClient.sendGameAction(matchId, "confirm_scoring");
              gameDispatch({ type: "SET_SCORING_MODE", payload: true });
            }}
            onRequestDraw={() => alert("Request draw not implemented")}
            onExportSGF={() => {
              console.log("[GoGamePage] export_sgf => game_update");
              socketClient.sendGameAction(matchId, "export_sgf");
            }}
            onNewGame={() => {
              console.log("[GoGamePage] newGame => confirmNewGameOpen = true");
              gameDispatch({ type: "SET_CONFIRM_NEW_GAME_OPEN", payload: true });
            }}
            onPrev={() => {
              console.log("[GoGamePage] PREV_STEP");
              gameDispatch({ type: "PREV_STEP" });
            }}
            onNext={() => {
              console.log("[GoGamePage] NEXT_STEP");
              gameDispatch({ type: "NEXT_STEP" });
            }}
            gameOver={gameOver}
            currentStep={currentStep}
            historyLength={history.length}
          />

          {scoringMode && (
            <ScoringPanel
              currentPlayer={currentPlayer}
              blackScore={scoringData.blackScore}
              whiteScore={scoringData.whiteScore}
              onConfirmScoring={() => {
                console.log("[GoGamePage] confirm_scoring again");
                socketClient.sendGameAction(matchId, "confirm_scoring");
              }}
              onCancelScoring={() =>
                gameDispatch({ type: "SET_SCORING_MODE", payload: false })
              }
            />
          )}

          {errorMessage && (
            <div style={{ marginTop: 8 }}>
              <Typography color="error">{errorMessage}</Typography>
              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: 8 }}
                onClick={() => (window.location.href = "/lobby")}
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

          <ResignConfirmModal
            open={confirmResignOpen}
            onClose={() => gameDispatch({ type: "SET_CONFIRM_RESIGN_OPEN", payload: false })}
            onConfirm={() => {
              console.log("[GoGamePage] Resign confirmed => sending resign action");
              socketClient.sendGameAction(matchId, "resign", { player: currentPlayer });
              gameDispatch({ type: "SET_CONFIRM_RESIGN_OPEN", payload: false });
            }}
          />
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
    </div>
  );
}

export default GoGamePage;
