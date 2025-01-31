import React from "react";
import "antd/dist/reset.css";
import ReactDOM from "react-dom/client";
import { AuthProvider as OIDCAuthProvider } from "react-oidc-context";
import { AuthProvider } from "./context/AuthContext";
import { RoomProvider } from "./context/RoomContext";
import { GameProvider } from "./context/GameContext";
import App from "./App";

// Cognito OIDC configuration
const oidcConfig = {
  authority: process.env.REACT_APP_COGNITO_AUTHORITY,
  client_id: process.env.REACT_APP_COGNITO_CLIENT_ID,
  redirect_uri: process.env.REACT_APP_COGNITO_REDIRECT_URI,
  response_type: "code",
  scope: "openid profile email phone",
};

const root = ReactDOM.createRoot(document.getElementById("root"));

// ======= 取消 <React.StrictMode> 包裹，避免双重挂载导致 socket 监听被移除 =======
root.render(
  /* 移除React.StrictMode后，其余Provider仍保持 */
  <OIDCAuthProvider {...oidcConfig}>
    <AuthProvider>
      <RoomProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </RoomProvider>
    </AuthProvider>
  </OIDCAuthProvider>
);
