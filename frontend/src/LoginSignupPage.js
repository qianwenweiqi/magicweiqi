import React from "react";
import { useAuth } from "react-oidc-context";
import { Box, Typography, Button } from "@mui/material";

function LoginSignupPage() {
  const auth = useAuth();

  // Handle custom sign-in
  const handleCustomSignIn = () => {
    const customLoginUrl = `https://us-east-1evhnl6tee.auth.us-east-1.amazoncognito.com/login?client_id=${process.env.REACT_APP_COGNITO_CLIENT_ID}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(process.env.REACT_APP_COGNITO_REDIRECT_URI)}`;

    // Redirect to Cognito Hosted UI
    window.location.href = customLoginUrl;
  };

  if (auth.isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Typography variant="h6">Loading...</Typography>
      </Box>
    );
  }

  if (auth.error) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Typography variant="h6" color="error">
          Error: {auth.error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center",
      }}
    >
      <Typography variant="h4" gutterBottom>
        Welcome to Magic Weiqi
      </Typography>
      {!auth.isAuthenticated ? (
        <Button
          variant="contained"
          color="primary"
          onClick={handleCustomSignIn}  // Custom sign-in on click
        >
          Sign In
        </Button>
      ) : (
        <Button
          variant="contained"
          color="secondary"
          onClick={() => auth.signoutRedirect()}  // Sign-out action remains the same
        >
          Sign Out
        </Button>
      )}
    </Box>
  );
}

export default LoginSignupPage;
