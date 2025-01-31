// frontend/src/utils/matchUtils.js
import axios from "axios";
import { API_BASE_URL } from "../config/config";

export const createMatch = async (config) => {
  const token = localStorage.getItem("token");
  
  // 检查用户是否已经在房间中
  try {
    const currentRoomRes = await axios.get(
      `${API_BASE_URL}/api/v1/rooms/current`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (currentRoomRes.data?.room_id) {
      throw new Error('Already in another room');
    }
  } catch (error) {
    // 404表示用户不在任何房间中，是正常情况
    if (error.response?.status === 404) {
      // 继续创建房间
    } else if (error.response?.status === 400) {
      // 400表示业务逻辑错误，比如已经在其他房间
      throw new Error(error.response.data?.detail || 'Already in another room');
    } else {
      // 其他错误(如500)不应该阻止创建房间
      console.warn('Error checking current room:', error);
    }
  }

  // Validate required fields
  const requiredFields = [
    'eloMin', 'eloMax', 'whoIsBlack', 'timeRule', 
    'mainTime', 'byoYomiPeriods', 'byoYomiTime',
    'boardSize', 'handicap'
  ];
  
  // sgfContent是可选的
  if (config.sgfContent !== undefined && config.sgfContent !== null) {
    if (typeof config.sgfContent !== 'string') {
      throw new Error('SGF content must be a string');
    }
  }
  
  const missingFields = requiredFields.filter(field => !(field in config));
  if (missingFields.length > 0) {
    console.error('Missing required fields:', missingFields);
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Log the config being sent
  console.log('Creating room with config:', config);
  console.log('Request headers:', {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  try {
    console.log('Sending room creation request with config:', config);
    // -----------------------------
    // 这里改成 /api/v1/rooms
    // -----------------------------
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/rooms`,
      config,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Room creation response:', response.data);
    return response.data.room_id;
  } catch (error) {
    console.error('Error creating match:', error);
    
    // Handle specific error cases
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail;
      
      if (status === 422) {
        console.error('Validation error:', detail);
        throw new Error('Invalid room configuration: ' + detail);
      } else if (status === 400) {
        console.error('Bad request:', detail);
        throw new Error(detail || 'Failed to create room - invalid request');
      } else if (status === 401) {
        console.error('Unauthorized:', detail);
        throw new Error('Please log in again');
      } else {
        console.error('Server error:', detail);
        throw new Error(detail || 'Failed to create room - server error');
      }
    }
    
    // Handle network or other errors
    throw new Error('Failed to create room - please check your connection');
  }
};
