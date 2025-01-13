import axios from "axios";
import { API_BASE_URL } from "../config/config";

export const createMatch = async (config) => {
  const token = localStorage.getItem("token");
  
  // Validate required fields
  const requiredFields = [
    'eloMin', 'eloMax', 'whoIsBlack', 'timeRule', 
    'mainTime', 'byoYomiPeriods', 'byoYomiTime',
    'boardSize', 'handicap'
  ];
  
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
    const response = await axios.post(
      `${API_BASE_URL}/rooms`,
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
