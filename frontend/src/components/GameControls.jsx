import React from "react";
import { Button } from "@mui/material";

function GameControls({
  onPass,
  onResign,
  onRequestCounting,
  onRequestDraw,
  onExportSGF,
  onNewGame,
  onPrev,
  onNext,
  gameOver,
  currentStep,
  historyLength,
}) {
  return (
    <div style={{ marginTop: 20, textAlign: "center" }}>
      <Button
        onClick={onPrev}
        disabled={currentStep === 0}
        variant="outlined"
        style={{ margin: 4 }}
      >
        Prev
      </Button>
      <Button
        onClick={onNext}
        disabled={currentStep === historyLength - 1}
        variant="outlined"
        style={{ margin: 4 }}
      >
        Next
      </Button>
      <Button
        onClick={onPass}
        variant="outlined"
        style={{ margin: 4 }}
      >
        Pass
      </Button>
      <Button
        onClick={onResign}
        variant="outlined"
        color="error"
        style={{ margin: 4 }}
      >
        Resign
      </Button>
      <Button
        onClick={onRequestCounting}
        variant="outlined"
        style={{ margin: 4 }}
      >
        Request Counting
      </Button>
      <Button
        onClick={onRequestDraw}
        variant="outlined"
        style={{ margin: 4 }}
      >
        Request Draw
      </Button>
      <Button
        onClick={onExportSGF}
        variant="outlined"
        style={{ margin: 4 }}
        disabled={!gameOver}
      >
        Export SGF
      </Button>
      <Button
        onClick={onNewGame}
        variant="outlined"
        color="secondary"
        style={{ margin: 4 }}
      >
        New Game
      </Button>
    </div>
  );
}

export default GameControls;
