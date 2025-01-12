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

  useEffect(() => {
    const localUser = localStorage.getItem("username");
    if (localUser) {
      setUsername(localUser);
    }
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
    try {
      // 这里使用 API_BASE_URL + '/rooms'
      const res = await axios.get(`${API_BASE_URL}/rooms`);
      setRooms(res.data.rooms || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCustomGame = () => {
    setCreateRoomOpen(true);
  };

  const handleRoomCreate = async (roomConfig) => {
    setCreateRoomOpen(false);
    try {
      const token = localStorage.getItem("token");
      // POST到 /rooms
      const res = await axios.post(
        `${API_BASE_URL}/rooms`,
        { ...roomConfig },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newRoomId = res.data.room_id;
      navigate(`/room/${newRoomId}`);
    } catch (err) {
      alert("Failed to create room: " + err.message);
    }
  };

  // Placeholder
  const handleJoinPlaceholder = () => {
    const placeholderMatchId = "placeholder-match";
    navigate(`/game/${placeholderMatchId}`);
  };

  // Join room
  const handleJoinRoom = async (roomId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/rooms/${roomId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/room/${roomId}`);
    } catch (err) {
      alert("Failed to join room: " + (err.response?.data?.detail || err.message));
    }
  };

  // Go to ReviewRoom
  const handleGoToReviewRoom = () => {
    navigate("/review");
  };

  return (
    <div style={{ padding: 20 }}>
      <Typography variant="h4" gutterBottom>
        Lobby
      </Typography>

      <Paper style={{ padding: 16, marginBottom: 16 }}>
        <Typography variant="h6" gutterBottom>
          Welcome, {username || "Guest"}!
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
          <Paper key={room.room_id} style={{ padding: 8, margin: 8 }}>
            <Typography>Room ID: {room.room_id}</Typography>
            <Typography>
              ELO Range: {room.eloMin} - {room.eloMax}
            </Typography>
            <Typography>Players: {room.players.join(", ")}</Typography>
            <Typography>Started: {room.started ? "Yes" : "No"}</Typography>
            <Button
              variant="outlined"
              onClick={() => handleJoinRoom(room.room_id)}
              style={{ marginTop: 6 }}
            >
              Join
            </Button>
          </Paper>
        ))}
      </Paper>

      <RoomCreationModal
        open={createRoomOpen}
        onClose={() => setCreateRoomOpen(false)}
        onCreate={handleRoomCreate}
      />
    </div>
  );
}

export default Lobby;
