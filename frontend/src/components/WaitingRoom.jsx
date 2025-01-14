import React from "react";
import { Button, CircularProgress, Typography } from "@mui/material";

function WaitingRoom({ selectedRoom, username, onReady }) {
  console.log("[WaitingRoom] render => selectedRoom:", selectedRoom, "username:", username);

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <CircularProgress style={{ marginBottom: 20 }} />
      <Typography variant="h6" gutterBottom>
        Players
      </Typography>
      <div style={{ marginBottom: 20 }}>
        {(selectedRoom?.players || [{ username, elo: 1500 }]).map((player) => {
          return (
            <div
              key={player.username}
              style={{
                marginBottom: 10,
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 4
              }}
            >
              <Typography variant="subtitle1">{player.username}</Typography>
              <Typography variant="body2" color="textSecondary">
                ELO: {player.elo}
              </Typography>
              <div
                style={{
                  border: `2px solid ${
                    (selectedRoom?.ready || {})[player.username]
                      ? '#4caf50'
                      : '#ff9800'
                  }`,
                  borderRadius: 4,
                  padding: 5,
                  marginTop: 5,
                  backgroundColor: (selectedRoom?.ready || {})[player.username]
                    ? 'rgba(76, 175, 80, 0.1)'
                    : 'rgba(255, 152, 0, 0.1)'
                }}
              >
                <Typography
                  variant="body2"
                  color={
                    (selectedRoom?.ready || {})[player.username]
                      ? "success.main"
                      : "warning.main"
                  }
                  style={{ fontWeight: 'bold' }}
                >
                  {(selectedRoom?.ready || {})[player.username]
                    ? "Ready"
                    : "Not Ready"}
                </Typography>
              </div>
              {player.username === username &&
                !(selectedRoom?.ready || {})[username] &&
                selectedRoom?.players?.length === 2 && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={onReady}
                    style={{ marginTop: 10 }}
                    fullWidth
                  >
                    Ready
                  </Button>
                )}
            </div>
          );
        })}
      </div>
      {!selectedRoom?.players ? (
        <Typography variant="body2" color="textSecondary">
          Creating room...
        </Typography>
      ) : selectedRoom.players.length === 1 ? (
        <Typography variant="body2" color="textSecondary">
          Waiting for another player to join...
        </Typography>
      ) : selectedRoom.players.length === 2 &&
        !(selectedRoom?.ready || {})[username] ? (
        <Typography variant="body2" color="textSecondary">
          Press "Ready" to start
        </Typography>
      ) : selectedRoom.players.length === 2 &&
        (selectedRoom?.ready || {})[username] ? (
        <Typography variant="body2" color="textSecondary">
          Waiting for the other player to be ready...
        </Typography>
      ) : null}
    </div>
  );
}

export default WaitingRoom;
