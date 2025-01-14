import { API_BASE_URL } from '../config/config';

export const login = async (username, password) => {
    // 清除任何可能存在的旧token
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    
    const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
        throw new Error("Login failed");
    }
    const data = await response.json();
    if (!data.access_token) {
      throw new Error("Invalid token received");
    }
    // Verify token structure matches backend
    try {
      const tokenParts = data.access_token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error("Invalid token format");
      }
      const payload = JSON.parse(atob(tokenParts[1]));
      if (!payload.sub || !payload.exp) {
        throw new Error("Invalid token payload");
      }
    } catch (err) {
      throw new Error("Invalid token received: " + err.message);
    }
    
    localStorage.setItem("token", data.access_token);
    const user = await fetchUserInfo();
    const authData = {
      ...user,
      token: data.access_token
    };
    localStorage.setItem("user", JSON.stringify(authData));
};

export const fetchUserInfo = async () => {
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            throw new Error("Failed to fetch user info");
        }
        return await response.json();
    } catch (error) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        throw error;
    }
};

export const isAuthenticated = () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");
    return !!(user && token);
};

export const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};
