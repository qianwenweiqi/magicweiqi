import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography, Paper, Grid } from "@mui/material";
import axios from "axios";

const LobbyPage = () => {
  const [matches, setMatches] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // 从后端获取对局列表
    axios
      .get("http://127.0.0.1:8000/api/v1/matches")
      .then((res) => setMatches(res.data))
      .catch((err) => console.error("Failed to fetch matches:", err));
  }, []);

  const joinMatch = (matchId) => {
    navigate(`/game/${matchId}`);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Game Lobby
      </Typography>
      <Grid container spacing={2}>
        {matches.map((match) => (
          <Grid item xs={12} md={6} key={match.match_id}>
            <Paper elevation={3} style={{ padding: "16px" }}>
              <Typography variant="h6">Match ID: {match.match_id}</Typography>
              <Typography>Board Size: {match.board_size}x{match.board_size}</Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => joinMatch(match.match_id)}
                style={{ marginTop: "16px" }}
              >
                Join Match
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default LobbyPage;
