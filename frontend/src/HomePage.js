// HomePage.js
import React from "react";
import { Button, Typography, Container, Box } from "@mui/material";
import { useAuth } from "react-oidc-context";

function HomePage() {
  const auth = useAuth();

  const handleSignOut = () => {
    auth.removeUser(); // Log the user out
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ textAlign: "center", marginTop: "50px" }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Magic Weiqi
        </Typography>
        <Typography variant="body1" gutterBottom>
          You're signed in as {auth.user?.profile.email}.
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleSignOut}
          sx={{ margin: "10px" }}
        >
          Sign Out
        </Button>
      </Box>
    </Container>
  );
}

export default HomePage;
