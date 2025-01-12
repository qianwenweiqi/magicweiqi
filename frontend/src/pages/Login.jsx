// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { TextField, Button, Paper, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { login } from "../services/auth";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      setMessage("Login successful!");
      // 登录成功后跳转到首页或Profile
      navigate("/profile");
    } catch (error) {
      setMessage(`Login failed: ${error.message}`);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="80vh"
      flexDirection="column"
    >
      <Paper sx={{ width: 400, p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Login
        </Typography>
        <form onSubmit={handleLogin}>
          <TextField
            fullWidth
            margin="normal"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="contained"
            sx={{ mt: 2 }}
            fullWidth
          >
            Login
          </Button>
        </form>
        {message && (
          <Typography color="error" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

export default Login;
