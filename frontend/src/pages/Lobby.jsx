// frontend/src/pages/Lobby.jsx
import React, { useState, useEffect } from "react";
import { Button, Typography, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/config";
import RoomCreationModal from "../components/RoomCreationModal";

function Lobby() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [rooms, setRooms] = useState([]);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    fetchUsername();
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsername = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await axios.get(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsername(response.data.username);
        localStorage.setItem("username", response.data.username);
      }
    } catch (err) {
      console.error("Failed to fetch username:", err);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/rooms`);
      setRooms(res.data.rooms || []);
      if (selectedRoom) {
        const updatedRoom = res.data.rooms?.find(r => r.room_id === selectedRoom.room_id);
        setSelectedRoom(updatedRoom || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCustomGame = () => {
    setCreateRoomOpen(true);
  };

  const handleRoomCreate = async (roomConfig) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/rooms`,
        { ...roomConfig },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newRoomId = res.data.room_id;
      await fetchRooms();
      const createdRoom = rooms.find(r => r.room_id === newRoomId);
      if (createdRoom) {
        setSelectedRoom(createdRoom);
      }
      return newRoomId;
    } catch (err) {
      alert("Failed to create room: " + err.message);
      return null;
    }
  };

  const handleJoinPlaceholder = () => {
    const placeholderMatchId = "placeholder-match";
    navigate(`/game/${placeholderMatchId}`);
  };

  const handleJoinRoom = async (roomId) => {
    try {
      const room = rooms.find(r => r.room_id === roomId);
      if (!room) {
        alert("Room no longer exists");
        return;
      }
      if (room.players.includes(username)) {
        alert("Cannot join your own room");
        return;
      }
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/rooms/${roomId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.match_id) {
        navigate(`/game/${response.data.match_id}`);
      }
    } catch (err) {
      alert("Failed to join room: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleGoToReviewRoom = () => {
    navigate("/review");
  };

  const handleDebugJoin = async (roomId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/rooms/${roomId}/debug-join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.match_id) {
        navigate(`/game/${response.data.match_id}`);
      }
    } catch (err) {
      alert("Failed to debug join room: " + (err.response?.data?.detail || err.message));
    }
  };

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
      </div>

      <Paper style={{ padding: 16 }}>
        <Typography variant="body1" gutterBottom>
          Active Rooms:
        </Typography>
        {rooms.map((room) => (
          <Paper 
            key={room.room_id} 
            style={{ 
              padding: 8, 
              margin: 8,
              border: selectedRoom?.room_id === room.room_id ? '2px solid #1976d2' : 'none',
              backgroundColor: selectedRoom?.room_id === room.room_id ? '#f5f5f5' : 'white'
            }}
          >
            <Typography>Room ID: {room.room_id}</Typography>
            <Typography>
              ELO Range: {room.eloMin} - {room.eloMax}
            </Typography>
            <Typography>Players: {room.players.join(", ")}</Typography>
            <Typography>Started: {room.started ? "Yes" : "No"}</Typography>
            <Button
              variant="outlined"
              onClick={() => handleJoinRoom(room.room_id)}
              style={{ marginTop: 6, marginRight: 6 }}
              disabled={room.players.includes(username)}
            >
              Join
            </Button>
            {room.started && (
              <Button
                variant="contained"
                onClick={() => navigate(`/game/${room.room_id}`)}
                style={{ marginTop: 6, marginLeft: 6 }}
              >
                Go to Match
              </Button>
            )}
            {username === "test" && room.players.includes("test") && !room.started && (
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => handleDebugJoin(room.room_id)}
                style={{ marginTop: 6 }}
              >
                Debug Join
              </Button>
            )}
          </Paper>
        ))}
      </Paper>

      <RoomCreationModal
        open={createRoomOpen}
        onClose={(shouldRefresh) => {
          setCreateRoomOpen(false);
          setSelectedRoom(null);
          if (shouldRefresh) {
            fetchRooms();
          }
        }}
        onCreate={handleRoomCreate}
        onDebugStart={handleDebugJoin}
        username={username}
      />
    </div>
  );
}

export default Lobby;
