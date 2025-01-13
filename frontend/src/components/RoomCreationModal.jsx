// frontend/src/components/RoomCreationModal.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/config";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
} from "@mui/material";

function RoomCreationModal({ open, onClose, onCreate, onDebugStart, username }) {
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [eloMin, setEloMin] = useState(0);
  const [eloMax, setEloMax] = useState(9999);
  const [createdRoomId, setCreatedRoomId] = useState(null);

  useEffect(() => {
    if (!createdRoomId) return;

    const websocket = new WebSocket(`${API_BASE_URL.replace('http', 'ws').replace('/api/v1', '')}/ws/rooms/${createdRoomId}`);
    setWs(websocket);

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'room_update' && data.players.length === 2) {
        // Close modal and redirect to game when second player joins
        onClose(false);
        navigate(`/game/${createdRoomId}`);
      }
    };

    return () => {
      websocket.close();
    };
  }, [createdRoomId, navigate, onClose]);

  const [whoIsBlack, setWhoIsBlack] = useState("creator");
  const [timeRule, setTimeRule] = useState("absolute");
  const [mainTime, setMainTime] = useState(300);
  const [byoYomiPeriods, setByoYomiPeriods] = useState(3);
  const [byoYomiTime, setByoYomiTime] = useState(30);
  const [isWaiting, setIsWaiting] = useState(false);

  const handleCreate = async () => {
    const config = {
      eloMin,
      eloMax,
      whoIsBlack,
      timeRule,
      mainTime,
      byoYomiPeriods,
      byoYomiTime,
      boardSize: 19,
      handicap: 0,
    };
    setIsWaiting(true);
    const roomId = await onCreate(config);
    setCreatedRoomId(roomId);
  };

  const handleClose = async () => {
    if (isWaiting && createdRoomId) {
      // Clean up the room if waiting is canceled
      const token = localStorage.getItem("token");
      try {
        await axios.delete(`${API_BASE_URL}/rooms/${createdRoomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Refresh room list after successful deletion
        if (typeof onClose === 'function') {
          onClose(true); // Pass true to indicate refresh is needed
        }
      } catch (error) {
        console.error('Error deleting room:', error);
      }
    } else {
      if (typeof onClose === 'function') {
        onClose(false); // Pass false for normal close
      }
    }
    setIsWaiting(false);
    setCreatedRoomId(null);
  };

  const handleDebugStart = async () => {
    if (createdRoomId) {
      await onDebugStart(createdRoomId);
      handleClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {isWaiting ? "Waiting for Opponent" : "Create Room"}
      </DialogTitle>
      <DialogContent>
        {isWaiting ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <CircularProgress style={{ marginBottom: '20px' }} />
            <Typography variant="h6">
              Waiting for an opponent to join...
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Your room has been created and is visible in the lobby
            </Typography>
            {username === "test" && (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleDebugStart}
                style={{ marginTop: '20px' }}
              >
                Debug Start with Virtual User
              </Button>
            )}
          </div>
        ) : (
          <>
            <TextField
              label="ELO Min"
              type="number"
              fullWidth
              margin="dense"
              value={eloMin}
              onChange={(e) => setEloMin(Number(e.target.value))}
            />
            <TextField
              label="ELO Max"
              type="number"
              fullWidth
              margin="dense"
              value={eloMax}
              onChange={(e) => setEloMax(Number(e.target.value))}
            />

            <FormControl fullWidth margin="dense">
              <InputLabel>Who is Black</InputLabel>
              <Select
                value={whoIsBlack}
                onChange={(e) => setWhoIsBlack(e.target.value)}
              >
                <MenuItem value="creator">Me (Creator)</MenuItem>
                <MenuItem value="opponent">Opponent</MenuItem>
                <MenuItem value="random">Random</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="dense">
              <InputLabel>Time Rule</InputLabel>
              <Select
                value={timeRule}
                onChange={(e) => setTimeRule(e.target.value)}
              >
                <MenuItem value="absolute">Absolute</MenuItem>
                <MenuItem value="byoyomi">Byo-yomi</MenuItem>
              </Select>
            </FormControl>

            {timeRule === "absolute" ? (
              <TextField
                label="Main Time (sec)"
                type="number"
                fullWidth
                margin="dense"
                value={mainTime}
                onChange={(e) => setMainTime(Number(e.target.value))}
              />
            ) : (
              <>
                <TextField
                  label="Main Time (sec)"
                  type="number"
                  fullWidth
                  margin="dense"
                  value={mainTime}
                  onChange={(e) => setMainTime(Number(e.target.value))}
                />
                <TextField
                  label="Byo-yomi Time (sec)"
                  type="number"
                  fullWidth
                  margin="dense"
                  value={byoYomiTime}
                  onChange={(e) => setByoYomiTime(Number(e.target.value))}
                />
                <TextField
                  label="Byo-yomi Periods"
                  type="number"
                  fullWidth
                  margin="dense"
                  value={byoYomiPeriods}
                  onChange={(e) => setByoYomiPeriods(Number(e.target.value))}
                />
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {isWaiting ? "Cancel Wait" : "Cancel"}
        </Button>
        {!isWaiting && (
          <Button onClick={handleCreate} variant="contained">
            Create
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default RoomCreationModal;
