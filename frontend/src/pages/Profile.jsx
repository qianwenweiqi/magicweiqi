// frontend/src/pages/Profile.jsx

import React, { useState, useEffect } from "react";
import { Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar } from "@mui/material";
import { fetchUserInfo } from "../services/auth";

// Dummy game records data
const dummyRecords = [
  {
    date: "2023-10-01",
    opponent: "Player1",
    size: 19,
    handicap: "-",
    name: "Ranked Match",
    result: "B+Timeout"
  },
  {
    date: "2023-09-28", 
    opponent: "Player2",
    size: 19,
    handicap: "2",
    name: "Casual Game",
    result: "W+Resign"
  },
  {
    date: "2023-09-25",
    opponent: "Player3",
    size: 9,
    handicap: "-",
    name: "Quick Match",
    result: "B+3.5"
  }
];

function Profile() {
  const [user, setUser] = useState({ 
    username: "", 
    email: "",
    elo: 1500,
    avatar: "https://mui.com/static/images/avatar/1.jpg"
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await fetchUserInfo();
        setUser({ 
          ...data,
          elo: data.elo || 1500,
          avatar: data.avatar || "https://mui.com/static/images/avatar/1.jpg"
        });
      } catch (err) {
        setError("Failed to load profile. Are you logged in?");
      }
    };
    loadProfile();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
        <Paper style={{ width: 300, padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Avatar 
              src={user.avatar}
              sx={{ width: 100, height: 100, mb: 2 }}
            />
            <Typography variant="h5" gutterBottom>
              {user.username}
            </Typography>
            <Typography>Email: {user.email}</Typography>
            <Typography>ELO Rating: {user.elo}</Typography>
          </div>
        </Paper>

        <Paper style={{ width: 600, padding: 20 }}>
          <Typography variant="h6" gutterBottom>
            Game Records
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Opponent</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Handicap</TableCell>
                  <TableCell>Game Name</TableCell>
                  <TableCell>Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dummyRecords.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>{record.opponent}</TableCell>
                    <TableCell>{record.size}</TableCell>
                    <TableCell>{record.handicap}</TableCell>
                    <TableCell>{record.name}</TableCell>
                    <TableCell>{record.result}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </div>
    </div>
  );
}

export default Profile;
