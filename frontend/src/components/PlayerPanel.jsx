import React from "react";
import { Paper, Typography } from "@mui/material";

function PlayerPanel({ 
  playerData, 
  time, 
  captured, 
  cards, 
  color 
}) {
  return (
    <Paper style={{ padding: "8px", marginBottom: "8px" }}>
      <Typography variant="subtitle1" style={{ fontWeight: "bold" }}>
        Player ({color})
      </Typography>
      <Typography>Username: {playerData.player_id}</Typography>
      <Typography>ELO: {playerData.elo}</Typography>
      <Typography>Time: {time}s</Typography>
      <Typography>Captured: {captured}</Typography>
      {cards.length > 0 && (
        <>
          <Typography variant="subtitle2" style={{ marginTop: 6 }}>
            {color} Cards
          </Typography>
          {cards.map((card) => (
            <Paper
              key={card.card_id}
              style={{ padding: "4px", marginTop: "4px" }}
              variant="outlined"
            >
              <Typography>
                {card.name} (Cost: {card.cost})
              </Typography>
              <Typography variant="body2">{card.description}</Typography>
            </Paper>
          ))}
        </>
      )}
    </Paper>
  );
}

export default PlayerPanel;
