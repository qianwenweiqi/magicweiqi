import React, { useState, useEffect, useCallback } from "react";
import { Button, Typography, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/config";
import RoomCreationModal from "../components/RoomCreationModal";
import socketClient from "../services/socketClient";
import { useRoomContext } from "../context/RoomContext";

function Lobby() {
  const navigate = useNavigate();
  const { state, dispatch } = useRoomContext();
  const { rooms, currentRoom, isCreator, createdRoomId } = state;
  const [username, setUsername] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // 拉取当前用户名
  const fetchUsername = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const res = await axios.get(`${API_BASE_URL}/api/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsername(res.data.username);
        localStorage.setItem("username", res.data.username);
      }
    } catch (err) {
      console.error("[Lobby] Failed to fetch username:", err);
    }
  };

  // 初始化lobby连接
  const initLobby = useCallback(async () => {
    try {
      // 1. 先获取用户信息
      await fetchUsername();
      
      // 2. 连接lobby (会自动加入大厅)
      const socket = await socketClient.connectToLobby();
      if (!socket) {
        throw new Error("[Lobby] Failed to connect to lobby");
      }
      
      // 3. 获取房间列表
      socketClient.sendMessage({ type: "get_rooms" });
      
    } catch (err) {
      console.error("[Lobby] Failed to initialize lobby:", err);
      // 如果是连接错误，尝试重连
      if (reconnectAttempt < 5) {
        setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          initLobby();
        }, 2000);
      }
    }
  }, [reconnectAttempt]);

  // 初次挂载时初始化
  useEffect(() => {
    initLobby();
  }, [initLobby]);

  // 拉取房间列表 (也可以点按钮手动刷新)
  const fetchRooms = async () => {
    try {
      console.log("[Lobby] fetchRooms() called");
      const res = await axios.get(`${API_BASE_URL}/api/v1/rooms`);
      dispatch({ type: 'SET_ROOMS', payload: res.data.rooms || [] });
    } catch (err) {
      console.error("[Lobby] Failed to fetch rooms:", err);
    }
  };

  const handleCreateCustomGame = () => {
    console.log("[Lobby] handleCreateCustomGame clicked");
    setModalOpen(true);
    dispatch({ type: 'SET_IS_CREATOR', payload: true });
    dispatch({ type: 'SET_CURRENT_ROOM', payload: null });
    dispatch({ type: 'SET_CREATED_ROOM_ID', payload: null });
  };

  const handleJoinPlaceholder = () => {
    console.log("[Lobby] handleJoinPlaceholder clicked");
    navigate(`/game/placeholder-match`);
  };

  const handleGoToReviewRoom = () => {
    console.log("[Lobby] handleGoToReviewRoom clicked");
    navigate("/review");
  };

  const handleDeleteRoom = useCallback(async (roomId) => {
    console.log(`[Lobby] handleDeleteRoom => Deleting room ${roomId}`);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Please log in again");
      }
      await axios.delete(`${API_BASE_URL}/api/v1/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      dispatch({ type: 'REMOVE_ROOM', payload: roomId });
      if (currentRoom?.room_id === roomId) {
        dispatch({ type: 'SET_CURRENT_ROOM', payload: null });
        dispatch({ type: 'SET_CREATED_ROOM_ID', payload: null });
        dispatch({ type: 'SET_IS_CREATOR', payload: false });
      }
      // 广播房间删除
      socketClient.sendMessage({
        type: "room_delete",
        room_id: roomId,
      });
    } catch (err) {
      console.error("[Lobby] Error deleting room:", err);
      alert("Failed to delete room: " + (err.response?.data?.detail || err.message));
    }
  }, [dispatch, currentRoom]);

  const handleJoinRoom = useCallback(async (roomId) => {
    console.log(`[Lobby] handleJoinRoom => Attempting to join room ${roomId}`);
    try {
      const targetRoom = rooms.find((r) => r.room_id === roomId);
      if (!targetRoom) {
        throw new Error("Room no longer exists");
      }
      if (targetRoom.players.some((p) => p.username === username)) {
        throw new Error("Cannot join your own room");
      }
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Please log in again");
      }
      await axios.post(
        `${API_BASE_URL}/api/v1/rooms/${roomId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("[Lobby] Successfully joined room via REST API");

      // 加入房间
      await socketClient.joinRoom(roomId);
      
      // 打开modal (currentRoom会通过socket事件更新)
      setModalOpen(true);

    } catch (err) {
      console.error("[Lobby] Error joining room:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else {
        alert("Failed to join room: " + (err.response?.data?.detail || err.message));
      }
      setModalOpen(false);
    }
  }, [rooms, username, dispatch]);

  const handleModalClose = useCallback(async (shouldRefresh) => {
    console.log("[Lobby] handleModalClose => shouldRefresh:", shouldRefresh);
    setModalOpen(false);
    dispatch({ type: 'SET_CURRENT_ROOM', payload: null });
    dispatch({ type: 'SET_IS_CREATOR', payload: false });
    dispatch({ type: 'SET_CREATED_ROOM_ID', payload: null });

    // 刷新房间列表
    if (shouldRefresh) {
      socketClient.sendMessage({ type: "get_rooms" });
    }
  }, [dispatch]);

  return (
    <div style={{ padding: 20 }}>
      <Typography variant="h4" gutterBottom>
        Lobby
      </Typography>

      <Paper style={{ padding: 16, marginBottom: 16 }}>
        <Typography variant="h6" gutterBottom>
          Welcome, {username}!
        </Typography>
        <Typography>
          This is the game lobby. Here you can create or join matches.
        </Typography>
      </Paper>

      <div style={{ marginBottom: 16 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateCustomGame}
          style={{ marginRight: 8 }}
        >
          Create Custom Game
        </Button>
        <Button
          variant="contained"
          onClick={handleJoinPlaceholder}
          style={{ marginRight: 8 }}
        >
          Join Placeholder Game
        </Button>
        <Button variant="contained" onClick={handleGoToReviewRoom}>
          Go to Review Room
        </Button>
        <Button
          variant="outlined"
          onClick={fetchRooms}
          style={{ marginLeft: 12 }}
        >
          Refresh Rooms
        </Button>
      </div>

      {!currentRoom && (
        <Paper style={{ padding: 16 }}>
          <Typography variant="body1" gutterBottom>
            Active Rooms:
          </Typography>
          {!Array.isArray(rooms) ? (
            <Typography color="textSecondary">Loading rooms...</Typography>
          ) : rooms.length === 0 ? (
            <Typography color="textSecondary">No active rooms</Typography>
          ) : (rooms || []).map((room) => (
            <Paper
              key={room.room_id}
              style={{
                padding: 8,
                margin: 8,
                border: currentRoom?.room_id === room.room_id ? "2px solid #1976d2" : "none",
                backgroundColor: currentRoom?.room_id === room.room_id ? "#f5f5f5" : "white",
              }}
            >
              <Typography>Room ID: {room.room_id}</Typography>
              <Typography>
                ELO Range: {room.eloMin || "-"} - {room.eloMax || "-"}
              </Typography>
              <Typography>
                Players: {(room.players || []).map((p) => p.username).join(", ")}
              </Typography>
              <Typography>Started: {room.started ? "Yes" : "No"}</Typography>
              <div style={{ display: "inline-block" }}>
                <Button
                  variant="outlined"
                  onClick={() => handleJoinRoom(room.room_id)}
                  style={{ marginRight: 6 }}
                  disabled={(room.players || []).some((p) => p.username === username)}
                >
                  Join
                </Button>
                {(room.players || [])[0]?.username === username && (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => handleDeleteRoom(room.room_id)}
                    style={{ marginRight: 6 }}
                  >
                    Delete
                  </Button>
                )}
              </div>
              {room.started && room.match_id && (
                <div style={{ marginTop: 8 }}>
                  <Typography
                    variant="body2"
                    style={{ color: "green", marginBottom: 4 }}
                  >
                    Game in progress
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => {
                      dispatch({ type: 'SET_CURRENT_ROOM', payload: room });
                      setModalOpen(true);
                    }}
                    style={{ marginTop: 4 }}
                  >
                    GO TO GAME
                  </Button>
                </div>
              )}
            </Paper>
          ))}
        </Paper>
      )}

      {modalOpen && (
        <RoomCreationModal
          open={modalOpen}
          onClose={handleModalClose}
          username={username}
          isCreator={isCreator}
          createdRoomId={createdRoomId}
          selectedRoom={currentRoom}
        />
      )}
    </div>
  );
}

export default Lobby;
