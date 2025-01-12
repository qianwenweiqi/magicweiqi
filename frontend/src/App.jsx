// frontend/src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import Profile from "./pages/Profile";
import GoGamePage from "./pages/GoGamePage";
import Lobby from "./pages/Lobby";
import Register from "./pages/Register";
import ReviewRoom from "./pages/ReviewRoom";
import Login from "./pages/Login";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/game/:matchId" element={<GoGamePage />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/review" element={<ReviewRoom />} />
      </Routes>
    </Router>
  );
}

export default App;
