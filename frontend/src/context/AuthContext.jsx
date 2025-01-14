// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useReducer, useEffect } from 'react';
import socketClient from '../services/socketClient';

const AuthContext = createContext();

// 验证用户数据格式
const validateUser = (user) => {
  if (!user) return null;
  return typeof user === 'object' && 
         user.token && 
         user.username ? user : null;
};

const authReducer = (state, action) => {
  try {
    switch (action.type) {
      case 'LOGIN': {
        const validUser = validateUser(action.payload);
        if (!validUser) {
          localStorage.removeItem('user');
          return { ...state, user: null };
        }
        localStorage.setItem('user', JSON.stringify(validUser));
        // ---- 这里保留登录成功后自动连接到lobby ----
        socketClient.connect('lobby').then(() => {
          // 一旦连接成功后，主动发送 join_lobby
          socketClient.joinRoom('lobby');
        });
        return { ...state, user: validUser };
      }
      case 'LOGOUT': {
        localStorage.removeItem('user');
        // ---- 退出时断开所有socket连接 ----
        socketClient.disconnect(); // 不带参数 => disconnect all
        return { ...state, user: null };
      }
      default:
        return state;
    }
  } catch (error) {
    console.error('Auth reducer error:', error);
    localStorage.removeItem('user');
    return { ...state, user: null };
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, { 
    user: JSON.parse(localStorage.getItem('user')) 
  });

  // 监听storage事件以同步不同标签页的状态
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'user') {
        dispatch({
          type: e.newValue ? 'LOGIN' : 'LOGOUT',
          payload: e.newValue ? JSON.parse(e.newValue) : null
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 页面加载时检查localStorage状态
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (validateUser(user)) {
          dispatch({ type: 'LOGIN', payload: user });
        } else {
          localStorage.removeItem('user');
        }
      }
    } catch (error) {
      console.error('Failed to parse user data:', error);
      localStorage.removeItem('user');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      ...state, 
      dispatch,
      isAuthenticated: !!state.user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
