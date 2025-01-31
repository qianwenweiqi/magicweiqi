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

  // Fetch current username
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

  // Initialize lobby connection
  const initLobby = useCallback(async () => {
    try {
      // 1. Get user info
      await fetchUsername();
      
      // 2. Connect to lobby (auto-join)
      const socket = await socketClient.connectToLobby();
      if (!socket) {
        throw new Error("[Lobby] Failed to connect to lobby");
      }
      
      // 3. Get room list
      socketClient.sendMessage({ type: "get_rooms" });
      
    } catch (err) {
      console.error("[Lobby] Failed to initialize lobby:", err);
      // Try reconnect if connection error
      if (reconnectAttempt < 5) {
        setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          initLobby();
        }, 2000);
      }
    }
  }, [reconnectAttempt]);

  // Initialize on mount
  useEffect(() => {
    initLobby();
  }, [initLobby]);

  // Fetch room list (can also refresh manually)
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
      // Broadcast room deletion with room_id
      socketClient.sendMessage({
        type: "room_deleted",
        room_id: roomId
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

      // Set isJoiner state
      dispatch({ type: 'SET_STATE', payload: { isJoiner: true } });

      // Join room
      await socketClient.joinRoom(roomId);
      
      // Open modal (currentRoom will update via socket event)
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
    dispatch({ type: 'SET_STATE', payload: { isJoiner: false } });

    // Refresh room list
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
              <Typography>
                {room.started ? `Game ID: ${room.match_id}` : `Room ID: ${room.room_id}`}
              </Typography>
              <Typography>
                ELO Range: {room.eloMin || "-"} - {room.eloMax || "-"}
              </Typography>
              <Typography>
                Creator: {(room.players || [])[0]?.username}
              </Typography>
              <Typography>
                Players: {(room.players || []).map((p) => p.username).join(", ")}
              </Typography>
              <Typography>
                Status: {room.started ? (room.game_over ? "Finished" : "In Progress") : "Not Started"}
                {room.game_over && room.winner && ` - ${room.winner}`}
              </Typography>
              <div style={{ display: "inline-block" }}>
                {!room.started && (
                  <Button
                    variant="outlined"
                    onClick={() => handleJoinRoom(room.room_id)}
                    style={{ marginRight: 6 }}
                    disabled={(room.players || []).some((p) => p.username === username)}
                  >
                    Join
                  </Button>
                )}
                {room.started && !room.game_over && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      dispatch({ type: 'SET_CURRENT_ROOM', payload: room });
                      setModalOpen(true);
                    }}
                    style={{ marginRight: 6 }}
                  >
                    Watch
                  </Button>
                )}
                {/* Only creator can delete not started or finished rooms */}
                {(room.players || [])[0]?.username === username && 
                  (!room.started || room.game_over) && (
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => handleDeleteRoom(room.room_id)}
                      style={{ marginRight: 6 }}
                    >
                      Delete Room
                    </Button>
                )}
              </div>
              {room.started && room.match_id && !room.game_over && (
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
