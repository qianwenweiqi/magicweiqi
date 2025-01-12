// frontend/src/pages/HomePage.js
import React, { useState, useEffect } from "react";
import { fetchUserInfo } from "../services/auth";

function HomePage() {
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userInfo = await fetchUserInfo();
        setUsername(userInfo.username);
        setIsLoggedIn(true);
      } catch {
        setIsLoggedIn(false);
      }
    };
    fetchUser();
  }, []);

  return (
    <div>
      <h1>Welcome to Magic Weiqi</h1>
      {isLoggedIn ? (
        <p>You're signed in as {username}</p>
      ) : (
        <p>You're not signed in.</p>
      )}
    </div>
  );
}

export default HomePage;
