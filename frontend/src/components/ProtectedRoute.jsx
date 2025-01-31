// frontend/src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/" />;
}

export default ProtectedRoute;
