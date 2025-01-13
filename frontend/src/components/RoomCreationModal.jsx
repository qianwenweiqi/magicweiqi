// frontend/src/components/RoomCreationModal.jsx
import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/config";
import { createMatch } from "../utils/matchUtils";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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

function RoomCreationModal({ open, onClose, onCreate, username, isCreator, createdRoomId, selectedRoom }) {
  const navigate = useNavigate();
  const [eloMin, setEloMin] = useState(0);
  const [eloMax, setEloMax] = useState(9999);
  const [whoIsBlack, setWhoIsBlack] = useState("creator");
  const [timeRule, setTimeRule] = useState("absolute");
  const [mainTime, setMainTime] = useState(300);
  const [byoYomiPeriods, setByoYomiPeriods] = useState(3);
  const [byoYomiTime, setByoYomiTime] = useState(30);
  const [isWaiting, setIsWaiting] = useState(false);

  const handleReady = async () => {
    const token = localStorage.getItem("token");
    if (!createdRoomId) return;

    try {
      await axios.post(
        `${API_BASE_URL}/rooms/${createdRoomId}/ready`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error marking ready:', error);
    }
  };

  const handleCreate = async () => {
    if (isWaiting) return;

    const config = {
      eloMin: parseInt(eloMin, 10),
      eloMax: parseInt(eloMax, 10),
      whoIsBlack: whoIsBlack,
      timeRule: timeRule,
      mainTime: parseInt(mainTime, 10),
      byoYomiPeriods: parseInt(byoYomiPeriods, 10),
      byoYomiTime: parseInt(byoYomiTime, 10),
      boardSize: 19,
      handicap: 0,
    };

    // Validate config
    const validationErrors = [];
    if (eloMin < 0 || eloMin > 9999) validationErrors.push('eloMin must be between 0-9999');
    if (eloMax < 0 || eloMax > 9999) validationErrors.push('eloMax must be between 0-9999');
    if (eloMin > eloMax) validationErrors.push('eloMin cannot be greater than eloMax');
    if (!['creator', 'opponent', 'random'].includes(whoIsBlack)) validationErrors.push('Invalid whoIsBlack value');
    if (!['absolute', 'byoyomi'].includes(timeRule)) validationErrors.push('Invalid timeRule value');
    if (mainTime < 0) validationErrors.push('mainTime must be positive');
    if (byoYomiPeriods < 0) validationErrors.push('byoYomiPeriods must be positive');
    if (byoYomiTime < 0) validationErrors.push('byoYomiTime must be positive');

    if (validationErrors.length > 0) {
      alert(validationErrors.join('\n'));
      return;
    }

    setIsWaiting(true);
    try {
      const roomId = await createMatch(config);
      console.log('Room created successfully with ID:', roomId);
      onCreate?.(roomId);
    } catch (error) {
      setIsWaiting(false);
      
      const errorMessage = error.message || 'Failed to create room';
      if (errorMessage.includes('Please log in again')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        alert(errorMessage);
      }
    }
  };

  const handleClose = async () => {
    if (isWaiting && createdRoomId) {
      // 如果已经在等待过程中，但用户又取消了 => 删除房间
      const token = localStorage.getItem("token");
      try {
        await axios.delete(`${API_BASE_URL}/rooms/${createdRoomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        onClose?.(true);
      } catch (error) {
        console.error('Error deleting room:', error);
      }
    } else {
      onClose?.(false);
    }
    setIsWaiting(false);
  };

  const handleGameStart = (matchId) => {
    console.log('Game started, navigating to game:', matchId);
    onClose(false);
    navigate(`/game/${matchId}`, { replace: true });
  };

  // Add useEffect to handle game start when both players are ready
  useEffect(() => {
    if (selectedRoom?.players?.length === 2 && 
        selectedRoom.ready?.[selectedRoom.players[0].username] && 
        selectedRoom.ready?.[selectedRoom.players[1].username] &&
        selectedRoom.started &&
        selectedRoom.match_id) {
      handleGameStart(selectedRoom.match_id);
    }
  }, [selectedRoom]);

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {isWaiting || !isCreator ? "Game Room" : "Create Room"}
      </DialogTitle>
      <DialogContent>
        {isWaiting || !isCreator ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <CircularProgress style={{ marginBottom: '20px' }} />
            <Typography variant="h6" gutterBottom>
              Players
            </Typography>
            <div style={{ marginBottom: '20px' }}>
              {selectedRoom?.players.map((player) => (
                <div key={player.username} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <Typography variant="subtitle1">
                    {player.username} {player.username === username && "(You)"}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    ELO: {player.elo}
                  </Typography>
                  <Typography variant="body2" color={
                    selectedRoom.ready?.[player.username] ? "success.main" : "warning.main"
                  }>
                    {selectedRoom.ready?.[player.username] ? "Ready" : "Not Ready"}
                  </Typography>
                  {player.username === username && !selectedRoom.ready?.[username] && selectedRoom.players.length === 2 && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleReady}
                      style={{ marginTop: '10px' }}
                      fullWidth
                    >
                      Ready
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {selectedRoom?.players.length === 1 ? (
              <Typography variant="body2" color="textSecondary">
                Waiting for another player to join...
              </Typography>
            ) : selectedRoom?.players.length === 2 && selectedRoom.ready?.[username] ? (
              <Typography variant="body2" color="textSecondary">
                Waiting for {selectedRoom.players.find(p => p.username !== username).username} to be ready...
              </Typography>
            ) : null}
            {selectedRoom?.started && selectedRoom.match_id && handleGameStart(selectedRoom.match_id)}
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
          {isWaiting || !isCreator ? "Leave Room" : "Cancel"}
        </Button>
        {!isWaiting && isCreator && (
          <Button onClick={handleCreate} variant="contained">
            Create
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default RoomCreationModal;
