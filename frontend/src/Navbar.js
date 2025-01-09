import React from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { useAuth } from "react-oidc-context";
import { useNavigate } from "react-router-dom";

function Navbar() {
  const auth = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
  const clientId = process.env.REACT_APP_COGNITO_CLIENT_ID;
  const logoutUri = process.env.REACT_APP_COGNITO_REDIRECT_URI;
  const cognitoDomain = process.env.REACT_APP_COGNITO_AUTHORITY;

  window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
    logoutUri
  )}`;
};


  return (
    <AppBar position="static">
      <Toolbar>
        <Typography
          variant="h6"
          sx={{ flexGrow: 1, cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          Magic Weiqi
        </Typography>
        {auth.isAuthenticated ? (
          <Box>
            <Button color="inherit" onClick={() => navigate("/game/sample")}>
              Game
            </Button>
            <Button color="inherit" onClick={() => navigate("/profile")}>
              Profile
            </Button>
            <Button color="inherit" onClick={() => navigate("/lobby")}>
              Lobby
            </Button>
            <Button color="inherit" onClick={handleSignOut}>
              Logout
            </Button>
          </Box>
        ) : (
          <Button color="inherit" onClick={() => auth.signinRedirect()}>
            Login
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
