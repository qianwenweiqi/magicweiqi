import React, { useEffect, useState } from "react";
import { Box, Typography, Paper } from "@mui/material";
import axios from "axios";

const PlayerProfilePage = () => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // 从后端获取玩家资料
    axios
      .get("http://127.0.0.1:8000/api/v1/profile")
      .then((res) => setProfile(res.data))
      .catch((err) => console.error("Failed to fetch profile:", err));
  }, []);

  if (!profile) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Player Profile
      </Typography>
      <Paper elevation={3} style={{ padding: "16px" }}>
        <Typography variant="h5">Username: {profile.username}</Typography>
        <Typography>Elo: {profile.elo}</Typography>
        <Typography>Total Games: {profile.total_games}</Typography>
      </Paper>
    </Box>
  );
};

export default PlayerProfilePage;
