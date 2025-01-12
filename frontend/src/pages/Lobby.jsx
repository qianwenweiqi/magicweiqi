// frontend/src/pages/Lobby.jsx
import React, { useState, useEffect } from "react";
import { Button, Typography, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/config";

function Lobby() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");

  useEffect(() => {
    // 获取当前登录用户
    const localUser = localStorage.getItem("username");
    if (localUser) {
      setUsername(localUser);
    }
  }, []);

  const handleCreateCustomGame = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/matches`,
        { board_size: 19 },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const newMatchId = res.data.match_id;
      navigate(`/game/${newMatchId}`);
    } catch (err) {
      alert("Failed to create custom game: " + err.message);
    }
  };

  const handleJoinPlaceholder = () => {
    // 硬编码一个 matchId
    const placeholderMatchId = "placeholder-match";
    navigate(`/game/${placeholderMatchId}`);
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
        <Button variant="contained" onClick={handleJoinPlaceholder}>
          Join Placeholder Game
        </Button>
      </div>

      <Paper style={{ padding: 16 }}>
        <Typography variant="body1">
          In the future, you can see a list of active rooms here.
        </Typography>
      </Paper>
    </div>
  );
}

export default Lobby;
