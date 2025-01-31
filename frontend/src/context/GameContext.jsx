import { createContext, useContext, useReducer, useEffect, useRef } from "react";
import socketClient from "../services/socketClient";

/**
 * GameContext: 全局管理对局 (match) 的状态:
 *   - board[x][y], currentPlayer, passes, captured, 计时器, 历史记录, scoringMode 等
 *   - 在此处 setInterval 每秒更新计时； 不要在 GoGamePage 中再做
 *   - 在此处监听 "game_update" 并触发 UPDATE_GAME
 */

const GameContext = createContext();

const initialState = {
  matchId: null,
  board: Array(19).fill(null).map(() => Array(19).fill(null)),
  currentPlayer: "black",
  passes: 0,
  captured: { black: 0, white: 0 },
  history: [],
  currentStep: 0,
  gameOver: false,
  winner: null,
  players: [],
  blackCards: [],
  whiteCards: [],
  errorMessage: "",
  resignMessage: "",
  blackTimer: {
    main_time: 300,
    byo_yomi: 30,
    periods: 3,
  },
  whiteTimer: {
    main_time: 300,
    byo_yomi: 30,
    periods: 3,
  },
  confirmNewGameOpen: false,
  confirmResignOpen: false,
  sgfData: "",
  scoringMode: false,
  scoringData: {
    deadStones: [],
    territory: [],
    blackScore: 0,
    whiteScore: 0,
  },
};

function gameReducer(state, action) {
  switch (action.type) {
    case "SET_MATCH_ID":
      return { ...state, matchId: action.payload };

    case "LOAD_MATCH": {
      console.log("[GameContext] LOAD_MATCH => payload:", action.payload);
      
      // 添加空值检查
      if (!action.payload || !action.payload.board) {
        console.error("[GameContext] LOAD_MATCH => Invalid payload or missing board");
        return state;
      }

      // 创建新的 board 数组引用
      const initialBoard = action.payload.board.map((row) => [...row]);
      console.log("[GameContext] LOAD_MATCH => created initialBoard:", initialBoard);

      return {
        ...state,
        board: initialBoard,
        currentPlayer: action.payload.current_player,
        passes: action.payload.passes,
        captured: action.payload.captured || { black: 0, white: 0 },
        history: [
          {
            board: initialBoard,
            currentPlayer: action.payload.current_player,
            passes: action.payload.passes,
            captured: action.payload.captured || { black: 0, white: 0 },
            historyLength: action.payload.history_length,
            gameOver: action.payload.game_over,
            winner: action.payload.winner,
          },
        ],
        currentStep: 0,
        gameOver: action.payload.game_over,
        winner: action.payload.winner,
        blackTimer: action.payload.black_timer || state.blackTimer,
        whiteTimer: action.payload.white_timer || state.whiteTimer,
      };
    }

    case "UPDATE_GAME": {
      console.log("[GameContext] UPDATE_GAME => payload:", action.payload);
      
      // 添加空值检查
      if (!action.payload || !action.payload.board) {
        console.error("[GameContext] UPDATE_GAME => Invalid payload or missing board");
        return state;
      }

      const newBoard = action.payload.board.map((row) => [...row]);
      console.log("[GameContext] Board after update:", newBoard);

      const newHistoryEntry = {
        board: newBoard,
        currentPlayer: action.payload.current_player,
        passes: action.payload.passes ?? state.passes,
        captured: action.payload.captured ?? state.captured,
        historyLength: action.payload.history_length,
        gameOver: action.payload.game_over,
        winner: action.payload.winner,
      };

      return {
        ...state,
        board: newBoard,
        currentPlayer: action.payload.current_player,
        passes: action.payload.passes ?? state.passes,
        captured: action.payload.captured ?? state.captured,
        gameOver: action.payload.game_over,
        winner: action.payload.winner,
        history: [...state.history, newHistoryEntry],
        currentStep: state.history.length,
      };
    }

    case "SET_PLAYERS":
      return {
        ...state,
        players: action.payload.players || [],
        blackCards: action.payload.black_cards || [],
        whiteCards: action.payload.white_cards || [],
      };

    case "SET_ERROR":
      return { ...state, errorMessage: action.payload };

    case "UPDATE_TIMER": {
      // 每秒钟更新当前执棋方的剩余时间
      if (state.gameOver) return state;

      const newState = { ...state };
      const { blackTimer, whiteTimer } = newState;
      const currentPlayer = state.currentPlayer;

      if (currentPlayer === "black") {
        const t = { ...blackTimer };
        if (t.main_time > 0) {
          t.main_time -= 1;
        } else if (t.byo_yomi > 0) {
          t.byo_yomi -= 1;
          if (t.byo_yomi === 0 && t.periods > 0) {
            t.periods -= 1;
            t.byo_yomi = 30;
          }
        }
        newState.blackTimer = t;
        if (t.main_time === 0 && t.byo_yomi === 0 && t.periods === 0) {
          newState.gameOver = true;
          newState.winner = "White wins by timeout";
        }
      } else {
        const t = { ...whiteTimer };
        if (t.main_time > 0) {
          t.main_time -= 1;
        } else if (t.byo_yomi > 0) {
          t.byo_yomi -= 1;
          if (t.byo_yomi === 0 && t.periods > 0) {
            t.periods -= 1;
            t.byo_yomi = 30;
          }
        }
        newState.whiteTimer = t;
        if (t.main_time === 0 && t.byo_yomi === 0 && t.periods === 0) {
          newState.gameOver = true;
          newState.winner = "Black wins by timeout";
        }
      }
      return newState;
    }

    case "SET_CONFIRM_NEW_GAME_OPEN":
      return { ...state, confirmNewGameOpen: action.payload };

    case "SET_CONFIRM_RESIGN_OPEN":
      return { ...state, confirmResignOpen: action.payload };

    case "SET_SCORING_MODE":
      return { ...state, scoringMode: action.payload };

    case "PREV_STEP":
      if (state.currentStep > 0) {
        const prev = state.history[state.currentStep - 1];
        const prevBoard = prev.board.map((row) => [...row]);
        return {
          ...state,
          currentStep: state.currentStep - 1,
          board: prevBoard,
          currentPlayer: prev.currentPlayer,
          passes: prev.passes,
          captured: prev.captured,
          gameOver: prev.gameOver,
          winner: prev.winner,
        };
      }
      return state;

    case "NEXT_STEP":
      if (state.currentStep < state.history.length - 1) {
        const next = state.history[state.currentStep + 1];
        const nextBoard = next.board.map((row) => [...row]);
        return {
          ...state,
          currentStep: state.currentStep + 1,
          board: nextBoard,
          currentPlayer: next.currentPlayer,
          passes: next.passes,
          captured: next.captured,
          gameOver: next.gameOver,
          winner: next.winner,
        };
      }
      return state;

    case "RESET_GAME":
      return initialState;

    default:
      return state;
  }
}

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // 记录当前 socket 引用
  const currentSocketRef = useRef(null);

  // 处理后端发来的 "game_update"
  const handleGameUpdate = (data) => {
    console.log("[GameContext] handleGameUpdate => received data:", data);
    if (data.match_id === state.matchId) {
      dispatch({ type: "UPDATE_GAME", payload: data });
    } else {
      console.warn(
        "[GameContext] handleGameUpdate => mismatch matchId:",
        data.match_id,
        "!==",
        state.matchId
      );
    }
  };

  // matchId 改变时建立新连接
  useEffect(() => {
    if (!state.matchId) return;
    console.log("[GameContext] Setting up game connection and listeners for:", state.matchId);

    // 若之前有旧连接，则先断开
    if (currentSocketRef.current) {
      console.log("[GameContext] Cleaning up old socket for matchId:", state.matchId);
      socketClient.disconnect(state.matchId);
      currentSocketRef.current = null;
    }

    // 建新连接
    socketClient
      .connectToGame(state.matchId)
      .then((socket) => {
        if (socket) {
          console.log("[GameContext] Successfully connected to game:", state.matchId);
          currentSocketRef.current = socket;
          // 这里注册 "game_update" 事件回调 (不再自动 unsubscribe)
          socketClient.on("game_update", handleGameUpdate);
        } else {
          console.error("[GameContext] Failed to connect to game:", state.matchId);
        }
      })
      .catch((err) => {
        console.error("[GameContext] Error connecting to game:", err);
      });

    // 不再返回 unsubscribe，避免在 React.StrictMode 下重复 mount/unmount 导致监听消失
    return () => {
      console.log("[GameContext] useEffect unmount => do nothing");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.matchId]);

  // 每秒更新计时
  const timerRef = useRef(null);
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (!state.gameOver) {
      timerRef.current = setInterval(() => {
        dispatch({ type: "UPDATE_TIMER" });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [state.gameOver, dispatch]);

  // 统一落子方法
  const handleMove = (x, y) => {
    if (!state.matchId) {
      console.error("[GameContext] No matchId for move");
      return;
    }
    socketClient.sendMove(state.matchId, x, y);
  };

  return (
    <GameContext.Provider value={{ state, dispatch, handleMove }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};
