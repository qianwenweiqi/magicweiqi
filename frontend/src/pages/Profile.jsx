// frontend/src/pages/Profile.jsx

import React, { useState, useEffect } from "react";
import { Typography, Paper } from "@mui/material";
import { fetchUserInfo } from "../services/auth";

function Profile() {
  const [user, setUser] = useState({ username: "", email: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await fetchUserInfo();
        setUser({ username: data.username, email: data.email });
      } catch (err) {
        setError("Failed to load profile. Are you logged in?");
      }
    };
    loadProfile();
  }, []);

  return (
    <div style={{ padding: 20, display: "flex", justifyContent: "center" }}>
      <Paper style={{ width: 400, padding: 20 }}>
        <Typography variant="h5" gutterBottom>
          Profile
        </Typography>
        {error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <>
            <Typography>Username: {user.username}</Typography>
            <Typography>Email: {user.email}</Typography>
          </>
        )}
      </Paper>
    </div>
  );
}

export default Profile;
