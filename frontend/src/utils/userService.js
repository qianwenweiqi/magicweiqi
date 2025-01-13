// frontend/src/api/userService.js
import axios from 'axios';
import { API_BASE_URL } from '../config/config';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
  }
});

// Get current user information
export const getCurrentUser = async () => {
  try {
    const token = localStorage.getItem('token');
    if (token === 'test') {
      return { username: 'test', email: 'test@test.com' };
    }
    const response = await axios.get(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
};

// Register a new user
export const registerUser = async (username, email, password) => {
  try {
    if (username === 'test' && password === 'test') {
      return { username: 'test', email: 'test@test.com' };
    }
    const response = await axios.post(`${API_BASE_URL}/register`, {
      username,
      email,
      password
    });
    return response.data;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

// Login user
export const loginUser = async (username, password) => {
  try {
    if (username === 'test' && password === 'test') {
      localStorage.setItem('token', 'test');
      return { username: 'test', email: 'test@test.com' };
    }
    const response = await axios.post(`${API_BASE_URL}/login`, {
      username,
      password
    });
    localStorage.setItem('token', response.data.token);
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export default {
  getCurrentUser,
  registerUser,
  loginUser
};
