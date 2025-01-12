import React, { useState } from 'react';
import { Button, ListItem, Popover, Box, Typography } from '@mui/material';

function Lobby() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const isTestUser = user?.email?.includes('test');

  const handleCreateRoom = async (roomData) => {
    try {
      const newRoom = await createCustomGame(roomData);
      setCurrentRoom(newRoom);
      setAnchorEl(document.getElementById('lobby-container'));
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const renderRoomList = (rooms) => {
    return rooms.map((room) => (
      <ListItem key={room.id}>
        <Button
          variant="contained"
          onClick={() => handleJoinRoom(room.id)}
          disabled={room.createdBy === user?.id}
        >
          Join
        </Button>
      </ListItem>
    ));
  };

  return (
    <div id="lobby-container">
      <Popover
        open={Boolean(currentRoom)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        sx={{
          '& .MuiPopover-paper': {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            width: '300px',
            position: 'absolute',
            top: '20%',
          }
        }}
      >
        <Box p={2}>
          <Typography variant="h6">Waiting for players...</Typography>
          {isTestUser && (
            <Button 
              variant="contained" 
              onClick={() => {
                handleStartGame(currentRoom.id);
              }}
              sx={{ mt: 2 }}
            >
              Debug Start
            </Button>
          )}
        </Box>
      </Popover>
    </div>
  );
}

export default Lobby; 