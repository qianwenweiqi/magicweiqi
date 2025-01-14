// frontend/src/context/RoomContext.jsx

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import socketClient from '../services/socketClient';
import { useAuth } from './AuthContext';

const RoomContext = createContext();

const initialState = {
  rooms: [],
  currentRoom: null,
  isCreator: false,
  createdRoomId: null,
  isJoiner: false
};

function roomReducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };

    case 'SET_ROOMS':
      return { ...state, rooms: action.payload || [] };

    case 'ADD_ROOM':
      // 如果重复就不添加
      if (state.rooms.some(room => room.room_id === action.payload.room_id)) {
        return state;
      }
      return { ...state, rooms: [...state.rooms, action.payload] };

    case 'REMOVE_ROOM':
      return {
        ...state,
        rooms: state.rooms.filter(room => room.room_id !== action.payload)
      };

    case 'SET_CURRENT_ROOM':
      if (!action.payload) {
        return { ...state, currentRoom: null };
      }
      return { 
        ...state, 
        currentRoom: action.payload
      };

    case 'ROOM_UPDATE':
      {
        const updatedRoom = action.payload;
        // 更新rooms[]中的那一项
        const roomsAfterUpdate = state.rooms.map(room => 
          room.room_id === updatedRoom.room_id ? updatedRoom : room
        );
        // 如果 currentRoom 就是这个 room_id，则替换
        const newCurrentRoom =
          state.currentRoom?.room_id === updatedRoom.room_id
            ? updatedRoom
            : state.currentRoom;

        return {
          ...state,
          rooms: roomsAfterUpdate,
          currentRoom: newCurrentRoom
        };
      }

    case 'SET_IS_CREATOR':
      return { ...state, isCreator: action.payload };

    case 'SET_CREATED_ROOM_ID':
      return { ...state, createdRoomId: action.payload };

    case 'UPDATE_READY_STATE':
      {
        const { room_id, username, ready } = action.payload;
        // 先更新 rooms[]
        const roomsWithReadyState = state.rooms.map(room =>
          room.room_id === room_id
            ? {
                ...room,
                ready: {
                  ...room.ready,
                  [username]: ready
                }
              }
            : room
        );
        // 再更新 currentRoom (若正好是该房间)
        const currentRoomWithReadyState =
          state.currentRoom?.room_id === room_id
            ? {
                ...state.currentRoom,
                ready: {
                  ...state.currentRoom.ready,
                  [username]: ready
                }
              }
            : state.currentRoom;

        return {
          ...state,
          rooms: roomsWithReadyState,
          currentRoom: currentRoomWithReadyState
        };
      }

    default:
      return state;
  }
}

export const RoomProvider = ({ children }) => {
  // 兼容 user===null 情况
  const { user } = useAuth();
  const username = user ? user.username : "Guest";

  const [state, dispatch] = useReducer(roomReducer, {
    ...initialState,
    username
  });

  // 处理后端发来的各类房间事件
  const handleRoomUpdate = React.useCallback((data) => {
    console.log('[RoomContext] handleRoomUpdate =>', data);

    if (data.type === 'lobby_update') {
      // 这是大厅更新(所有rooms列表)
      const rooms = Array.isArray(data.rooms) ? data.rooms : [];
      console.log('[RoomContext] lobby_update => updated rooms:', rooms);
      dispatch({ type: 'SET_ROOMS', payload: rooms });

      // 如果我们已经有 currentRoom, 就尝试从 rooms[] 找对应项
      dispatch((currentState) => {
        if (currentState.currentRoom) {
          const updatedCurrentRoom = rooms.find(
            room => room.room_id === currentState.currentRoom.room_id
          );
          if (updatedCurrentRoom) {
            return { type: 'SET_CURRENT_ROOM', payload: updatedCurrentRoom };
          }
        }
        return { type: null };
      });
    }
    else if (data.type === 'room_update') {
      // 这是指定房间的最新信息
      const roomData = {
        ...data.data,
        players: data.data?.players || [],
        ready: data.data?.ready || {},
        room_id: data.room_id
      };
      console.log('[RoomContext] room_update => roomData:', roomData);
      dispatch({ type: 'ROOM_UPDATE', payload: roomData });

      // 若 createdRoomId 匹配, 说明是我建的 => isCreator = true
      if (state.createdRoomId === data.room_id) {
        dispatch({ type: 'SET_IS_CREATOR', payload: true });
      }
      // 如果(我是房主)或者(我的username在players里) => 更新currentRoom
      if (state.createdRoomId === data.room_id
          || roomData.players.some(p => p.username === username)) {
        dispatch({ type: 'SET_CURRENT_ROOM', payload: roomData });
      }
    }
    else if (data.type === 'set_is_joiner') {
      dispatch({ type: 'SET_STATE', payload: { isJoiner: data.isJoiner }});
    }
    else if (data.type === 'room_deleted') {
      // 表示后端删除了某房间
      dispatch((currentState) => ({
        type: 'SET_STATE',
        payload: {
          rooms: currentState.rooms.filter(r => r.room_id !== data.room_id),
          currentRoom: currentState.currentRoom?.room_id === data.room_id ? null : currentState.currentRoom
        }
      }));
    }
  }, [dispatch, state.createdRoomId, state.currentRoom, username]);

  // 处理后端的 readyStateUpdate
  const handleReadyStateUpdate = React.useCallback((data) => {
    console.log('[RoomContext] readyStateUpdate =>', data);
    dispatch({ type: 'UPDATE_READY_STATE', payload: data });
  }, [dispatch]);

  // 监听 socket.io event
  useEffect(() => {
    console.log('[RoomContext] Setting up socket event listeners');
    const unsubscribes = [
      socketClient.on('room_update', handleRoomUpdate),
      socketClient.on('lobby_update', handleRoomUpdate),
      socketClient.on('readyStateUpdate', handleReadyStateUpdate)
    ];
    return () => {
      console.log('[RoomContext] Cleaning up socket event listeners');
      unsubscribes.forEach(unsub => unsub());
    };
  }, [handleRoomUpdate, handleReadyStateUpdate]);

  // 如果 user 从 null->有值 或有值->null，更新 state.username
  useEffect(() => {
    dispatch({ type: 'SET_STATE', payload: { username: user ? user.username : "Guest" }});
  }, [user]);

  const value = { state, dispatch };
  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoomContext = () => {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error('useRoomContext must be used within a RoomProvider');
  }
  return context;
};
