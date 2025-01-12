// frontend/src/components/RoomCreationModal.jsx
import React, { useState } from "react";
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
} from "@mui/material";

function RoomCreationModal({ open, onClose, onCreate }) {
  const [eloMin, setEloMin] = useState(0);
  const [eloMax, setEloMax] = useState(9999);
  const [whoIsBlack, setWhoIsBlack] = useState("creator"); // or "opponent" or "random"
  const [timeRule, setTimeRule] = useState("absolute");    // or "byoyomi"
  const [mainTime, setMainTime] = useState(300);
  const [byoYomiPeriods, setByoYomiPeriods] = useState(3);
  const [byoYomiTime, setByoYomiTime] = useState(30);

  const handleCreate = () => {
    onCreate({
      eloMin,
      eloMax,
      whoIsBlack,
      timeRule,
      mainTime,
      byoYomiPeriods,
      byoYomiTime,
      boardSize: 19,
      handicap: 0, // 分先
    });
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Create Room</DialogTitle>
      <DialogContent>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained">
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RoomCreationModal;
