import { API_BASE_URL } from '../config/config';

export const login = async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
        throw new Error("Login failed");
    }
    const data = await response.json();
    localStorage.setItem("token", data.access_token);
};

export const fetchUserInfo = async () => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error("Failed to fetch user info");
    }
    return await response.json();
};

export const isAuthenticated = () => {
    return !!localStorage.getItem("token");
};

export const logout = () => {
    localStorage.removeItem("token");
};
