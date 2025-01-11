import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import App from "./App";

// Cognito OIDC configuration
const oidcConfig = {
  authority: process.env.REACT_APP_COGNITO_AUTHORITY, // Your Cognito Hosted UI domain
  client_id: process.env.REACT_APP_COGNITO_CLIENT_ID, // Your Cognito App Client ID
  redirect_uri: process.env.REACT_APP_COGNITO_REDIRECT_URI, // Your redirect URI
  response_type: "code", // Authorization code flow
  scope: "openid profile email phone", // Scopes you want to request
};

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthProvider {...oidcConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
