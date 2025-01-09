import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Backend URL

export const registerUser = async (username, email, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/register`, {
      username,
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || 'Registration failed');
  }
};

export const loginUser = async (username, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/login`, {
      username,
      password,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || 'Login failed');
  }
};
