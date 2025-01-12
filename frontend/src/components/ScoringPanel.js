// frontend/src/components/ScoringPanel.js
import React from "react";
import { Button, Typography } from "@mui/material";

function ScoringPanel({
  currentPlayer,
  blackScore,
  whiteScore,
  onConfirmScoring,
  onCancelScoring,
}) {
  return (
    <div style={{ padding: 10 }}>
      <Typography variant="h6">Scoring Mode</Typography>
      <Typography>Black Score: {blackScore}</Typography>
      <Typography>White Score: {whiteScore}</Typography>
      <div style={{ marginTop: 8 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={onConfirmScoring}
          style={{ marginRight: 8 }}
        >
          Ready / Confirm
        </Button>
        <Button variant="outlined" onClick={onCancelScoring}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default ScoringPanel;
