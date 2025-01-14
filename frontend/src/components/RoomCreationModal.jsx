// frontend/src/components/RoomCreationModal.jsx
import React, { useState, useEffect } from "react";
import { useRoomContext } from "../context/RoomContext";
import { API_BASE_URL } from "../config/config";
import { createMatch } from "../utils/matchUtils";
import socketClient from "../services/socketClient";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import WaitingRoom from "./WaitingRoom";
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

function RoomCreationModal({ open, onClose, onCreate, username }) {
  const { state: roomState, dispatch } = useRoomContext();
  const { currentRoom, createdRoomId, isCreator } = roomState;
  const navigate = useNavigate();

  const [eloMin, setEloMin] = useState(0);
  const [eloMax, setEloMax] = useState(9999);
  const [whoIsBlack, setWhoIsBlack] = useState("creator");
  const [timeRule, setTimeRule] = useState("absolute");
  const [mainTime, setMainTime] = useState(300);
  const [byoYomiPeriods, setByoYomiPeriods] = useState(3);
  const [byoYomiTime, setByoYomiTime] = useState(30);

  const [isCreating, setIsCreating] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isJoiner, setIsJoiner] = useState(false);

  // 根据 currentRoom、isCreator 判断：显示“创建表单”还是“等待房间”
  useEffect(() => {
    console.log("[RoomCreationModal] useEffect => currentRoom:", currentRoom, "isCreator:", isCreator);
    if (currentRoom && currentRoom.room_id) {
      // 如果当前用户不是房主（第一个玩家），那就是joiner
      const isUserJoiner = currentRoom.players[0]?.username !== username;
      setIsJoiner(isUserJoiner);
      setIsWaiting(true);
    } else {
      setIsJoiner(false);
      setIsWaiting(false);
    }
  }, [currentRoom, username]);

  // 点击“Ready”按钮
  const handleReady = async () => {
    console.log("[RoomCreationModal] handleReady => currentRoom:", currentRoom);
    if (!currentRoom?.room_id) return;
    const token = localStorage.getItem("token");
    try {
      await axios.post(
        `${API_BASE_URL}/api/v1/rooms/${currentRoom.room_id}/ready`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      dispatch({
        type: "UPDATE_READY_STATE",
        payload: {
          room_id: currentRoom.room_id,
          username,
          ready: true,
        },
      });
    } catch (error) {
      console.error("[RoomCreationModal] Error marking ready:", error);
      if (error.response?.status === 400) {
        alert("无法准备：请确保你在房间中且游戏未开始");
      }
    }
  };

  /**
   * 点击“Create”按钮创建房间
   */
  const handleCreate = async () => {
    console.log("[RoomCreationModal] handleCreate clicked => isWaiting:", isWaiting);
    setIsCreating(true);
    if (isWaiting) return;

    const config = {
      eloMin: parseInt(eloMin, 10),
      eloMax: parseInt(eloMax, 10),
      whoIsBlack,
      timeRule,
      mainTime: parseInt(mainTime, 10),
      byoYomiPeriods: parseInt(byoYomiPeriods, 10),
      byoYomiTime: parseInt(byoYomiTime, 10),
      boardSize: 19,
      handicap: 0,
    };

    // 简单验证
    const validationErrors = [];
    if (eloMin < 0 || eloMin > 9999) validationErrors.push("eloMin must be between 0~9999");
    if (eloMax < 0 || eloMax > 9999) validationErrors.push("eloMax must be between 0~9999");
    if (eloMin > eloMax) validationErrors.push("eloMin cannot exceed eloMax");
    if (!["creator", "opponent", "random"].includes(whoIsBlack)) validationErrors.push("Invalid whoIsBlack");
    if (!["absolute", "byoyomi"].includes(timeRule)) validationErrors.push("Invalid timeRule");
    if (mainTime < 0) validationErrors.push("mainTime must be >= 0");
    if (byoYomiPeriods < 0) validationErrors.push("byoYomiPeriods must be >= 0");
    if (byoYomiTime < 0) validationErrors.push("byoYomiTime must be >= 0");

    if (validationErrors.length) {
      alert(validationErrors.join("\n"));
      setIsCreating(false);
      return;
    }

    try {
      console.log("[RoomCreationModal] handleCreate => creating match with config:", config);
      // 发起后端创建请求
      const roomId = await createMatch(config);
      console.log("[RoomCreationModal] Room created with ID:", roomId);

      // 加入房间，等待room_update事件设置房间状态
      await socketClient.joinRoom(roomId);
      
      // 设置房间ID和创建者状态 (等socket连接成功后)
      dispatch({ type: "SET_CREATED_ROOM_ID", payload: roomId });
      setIsWaiting(true);
      setIsCreating(false);

      // 通知父组件
      onCreate?.(roomId);

    } catch (error) {
      console.error("[RoomCreationModal] Error creating room:", error);
      const errMsg = error.message || "Failed to create room";
      if (errMsg.includes("Please log in again")) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else {
        alert(errMsg);
      }
      setIsCreating(false);
    }
  };

  /**
   * 关闭对话框逻辑:
   * - 若是房主 && 当前房间没开始 => DELETE房间
   * - 否则仅做UI清理
   */
  const handleClose = async () => {
    console.log("[RoomCreationModal] handleClose => isCreator:", isCreator, "isWaiting:", isWaiting, "createdRoomId:", createdRoomId);
    try {
      if (isCreator && isWaiting && createdRoomId) {
        // 是房主 + 房间未开始 => 删除房间
        const token = localStorage.getItem("token");
        try {
          await axios.delete(`${API_BASE_URL}/api/v1/rooms/${createdRoomId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (error) {
          if (error.response?.status !== 404) {
            console.error("[RoomCreationModal] Error deleting room:", error);
          }
        }
        onClose?.(true);
      } else {
        // 其他情况只做UI关闭
        onClose?.(false);
      }
    } finally {
      // 都要断开socket & 重置本地状态
      if (createdRoomId) {
        socketClient.disconnect(createdRoomId);
      }
      setIsWaiting(false);
      setIsCreating(false);
      setIsJoiner(false);
      dispatch({ type: "SET_CURRENT_ROOM", payload: null });
      dispatch({ type: "SET_CREATED_ROOM_ID", payload: null });
      dispatch({ type: "REMOVE_ROOM", payload: createdRoomId });
    }
  };

  // 如果后端广播 room_update 显示已 started 并有 match_id => 跳转到对局
  const handleGameStart = (matchId) => {
    console.log("[RoomCreationModal] handleGameStart => matchId:", matchId);
    onClose(false);
    navigate(`/game/${matchId}`, { replace: true });
  };

  useEffect(() => {
    if (currentRoom?.started && currentRoom.match_id) {
      handleGameStart(currentRoom.match_id);
    }
  }, [currentRoom]);

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      onClose={(event, reason) => {
        // 禁用点击对话框背景或ESC来关闭
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          return;
        }
        handleClose();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {isJoiner ? "Join Room" : (isWaiting ? "Waiting Room" : "Create Room")}
      </DialogTitle>
      <DialogContent>
        {isWaiting || isJoiner ? (
          <WaitingRoom
            selectedRoom={currentRoom}
            username={username}
            onReady={handleReady}
            onGameStart={handleGameStart}
          />
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
          {isWaiting ? "Leave Room" : "Cancel"}
        </Button>
        {!isWaiting && !isJoiner && (
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default RoomCreationModal;
