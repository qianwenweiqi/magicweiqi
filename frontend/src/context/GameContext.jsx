import { createContext, useContext, useReducer } from 'react';

const GameContext = createContext();

const initialState = {
  matchId: null,
  board: [],
  currentPlayer: 'black',
  passes: 0,
  captured: { black: 0, white: 0 },
  history: [],
  currentStep: 0,
  gameOver: false,
  winner: null,
  players: [],
  blackCards: [],
  whiteCards: [],
  errorMessage: '',
  resignMessage: '',
  blackTimer: {
    main_time: 300,
    byo_yomi: 30,
    periods: 3
  },
  whiteTimer: {
    main_time: 300,
    byo_yomi: 30,
    periods: 3
  },
  confirmNewGameOpen: false,
  confirmResignOpen: false,
  sgfData: '',
  scoringMode: false,
  scoringData: {
    deadStones: [],
    territory: [],
    blackScore: 0,
    whiteScore: 0,
  },
  websocket: null
};

const gameReducer = (state, action) => {
  switch (action.type) {
    case 'SET_MATCH_ID':
      return { ...state, matchId: action.payload };
    
    case 'LOAD_MATCH':
      return {
        ...state,
        board: action.payload.board,
        currentPlayer: action.payload.current_player,
        passes: action.payload.passes,
        captured: action.payload.captured || { black: 0, white: 0 },
        history: [{
          board: action.payload.board,
          currentPlayer: action.payload.current_player,
          passes: action.payload.passes,
          captured: action.payload.captured || { black: 0, white: 0 },
          historyLength: action.payload.history_length,
          gameOver: action.payload.game_over,
          winner: action.payload.winner,
        }],
        currentStep: 0,
        gameOver: action.payload.game_over,
        winner: action.payload.winner,
        blackTimer: action.payload.black_timer || initialState.blackTimer,
        whiteTimer: action.payload.white_timer || initialState.whiteTimer
      };
    
    case 'UPDATE_GAME':
      return {
        ...state,
        board: action.payload.board,
        currentPlayer: action.payload.current_player,
        gameOver: action.payload.game_over,
        winner: action.payload.winner,
        captured: action.payload.captured || state.captured,
        passes: action.payload.passes || state.passes,
        history: [
          ...state.history.slice(0, state.currentStep + 1),
          {
            board: action.payload.board,
            currentPlayer: action.payload.current_player,
            passes: action.payload.passes || state.passes,
            captured: action.payload.captured || state.captured,
            historyLength: action.payload.history_length,
            gameOver: action.payload.game_over,
            winner: action.payload.winner,
          }
        ],
        currentStep: state.currentStep + 1
      };
    
    case 'SET_PLAYERS':
      return {
        ...state,
        players: action.payload.players || [],
        blackCards: action.payload.black_cards || [],
        whiteCards: action.payload.white_cards || []
      };
    
    case 'SET_ERROR':
      return { ...state, errorMessage: action.payload };
    
    case 'UPDATE_TIMER':
      const { currentPlayer } = state;
      if (currentPlayer === 'black') {
        const newBlackTimer = { ...state.blackTimer };
        if (newBlackTimer.main_time > 0) {
          newBlackTimer.main_time--;
        } else if (newBlackTimer.byo_yomi > 0) {
          newBlackTimer.byo_yomi--;
          if (newBlackTimer.byo_yomi === 0 && newBlackTimer.periods > 0) {
            newBlackTimer.periods--;
            newBlackTimer.byo_yomi = 30;
          }
        }
        return {
          ...state,
          blackTimer: newBlackTimer,
          gameOver: newBlackTimer.main_time === 0 && 
                   newBlackTimer.byo_yomi === 0 && 
                   newBlackTimer.periods === 0,
          winner: newBlackTimer.main_time === 0 && 
                  newBlackTimer.byo_yomi === 0 && 
                  newBlackTimer.periods === 0 ? 'White wins by time' : state.winner
        };
      } else {
        const newWhiteTimer = { ...state.whiteTimer };
        if (newWhiteTimer.main_time > 0) {
          newWhiteTimer.main_time--;
        } else if (newWhiteTimer.byo_yomi > 0) {
          newWhiteTimer.byo_yomi--;
          if (newWhiteTimer.byo_yomi === 0 && newWhiteTimer.periods > 0) {
            newWhiteTimer.periods--;
            newWhiteTimer.byo_yomi = 30;
          }
        }
        return {
          ...state,
          whiteTimer: newWhiteTimer,
          gameOver: newWhiteTimer.main_time === 0 && 
                   newWhiteTimer.byo_yomi === 0 && 
                   newWhiteTimer.periods === 0,
          winner: newWhiteTimer.main_time === 0 && 
                  newWhiteTimer.byo_yomi === 0 && 
                  newWhiteTimer.periods === 0 ? 'Black wins by time' : state.winner
        };
      }
    
    case 'SET_WEBSOCKET':
      return { ...state, websocket: action.payload };
    
    case 'SET_CONFIRM_NEW_GAME_OPEN':
      return { ...state, confirmNewGameOpen: action.payload };
    
    case 'SET_CONFIRM_RESIGN_OPEN':
      return { ...state, confirmResignOpen: action.payload };
    
    case 'SET_SCORING_MODE':
      return { ...state, scoringMode: action.payload };
    
    case 'PREV_STEP':
      if (state.currentStep > 0) {
        const snap = state.history[state.currentStep - 1];
        return {
          ...state,
          currentStep: state.currentStep - 1,
          board: snap.board,
          currentPlayer: snap.currentPlayer,
          passes: snap.passes,
          captured: snap.captured,
          gameOver: snap.gameOver,
          winner: snap.winner
        };
      }
      return state;
    
    case 'NEXT_STEP':
      if (state.currentStep < state.history.length - 1) {
        const snap = state.history[state.currentStep + 1];
        return {
          ...state,
          currentStep: state.currentStep + 1,
          board: snap.board,
          currentPlayer: snap.currentPlayer,
          passes: snap.passes,
          captured: snap.captured,
          gameOver: snap.gameOver,
          winner: snap.winner
        };
      }
      return state;
    
    case 'RESET_GAME':
      return initialState;
    
    default:
      return state;
  }
};

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
