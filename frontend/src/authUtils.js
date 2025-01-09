const API_BASE_URL = "http://localhost:8000"; // Backend URL

// Login function
export async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorText = await response.text(); // Get the error message from the response
    try {
      const error = JSON.parse(errorText); // Parse error as JSON if possible
      throw new Error(error.detail || "Login failed");
    } catch {
      throw new Error("Unexpected error: " + errorText);
    }
  }

  const data = await response.json(); // Parse JSON response
  localStorage.setItem("authToken", data.access_token); // Store token
  return data;
}

// Logout function
export function logout() {
  localStorage.removeItem("authToken");
}

export async function fetchUserInfo() {
  const token = localStorage.getItem("authToken");
  if (!token) throw new Error("No token found");

  const response = await fetch("http://127.0.0.1:8000/api/v1/users/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok) {
    const userInfo = await response.json();
    return userInfo;
  } else {
    throw new Error("Failed to fetch user info");
  }
}

// Check if authenticated
export function isAuthenticated() {
  return !!localStorage.getItem("authToken");
}

// Get Auth Token
export function getAuthToken() {
  return localStorage.getItem("authToken");
}
