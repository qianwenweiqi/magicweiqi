// frontend/src/pages/Lobby.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Button, Typography, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/config";
import RoomCreationModal from "../components/RoomCreationModal";
import websocketService from "../services/websocketService";

function Lobby() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [rooms, setRooms] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState(null);

  /**
   * 拉取当前用户名
   */
  const fetchUsername = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await axios.get(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsername(response.data.username);
        localStorage.setItem("username", response.data.username);
      }
    } catch (err) {
      console.error("Failed to fetch username:", err);
    }
  };

  /**
   * 拉取房间列表
   */
  const fetchRooms = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/rooms`);
      setRooms(res.data.rooms || []);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    }
  };

  /**
   * 更新房间数据
   */
  const updateRoomData = useCallback(
    (roomId, data) => {
      setRooms((prevRooms) => {
        const roomIndex = prevRooms.findIndex((r) => r.room_id === roomId);
        if (roomIndex === -1) {
          // 不在列表里就新增
          return [...prevRooms, data];
        }
        // 更新旧有房间的数据
        const updatedRooms = [...prevRooms];
        updatedRooms[roomIndex] = {
          ...updatedRooms[roomIndex],
          ...data,
          players: data.players,
          ready: data.ready,
        };
        return updatedRooms;
      });

      // 若当前正在看的房间正好就是 roomId，也要同步更新
      if (selectedRoom?.room_id === roomId) {
        setSelectedRoom((prev) => ({
          ...prev,
          ...data,
          players: data.players,
          ready: data.ready,
        }));
      }
    },
    [selectedRoom]
  );

  /**
   * 处理 WebSocket 的 error / 最大重连次数
   */
  const handleWebSocketError = useCallback(
    (roomId) => {
      console.error(`WebSocket error for room ${roomId}`);
      setRooms((prevRooms) => prevRooms.filter((r) => r.room_id !== roomId));
      if (selectedRoom?.room_id === roomId) {
        setSelectedRoom(null);
        setModalOpen(false);
        setCreatedRoomId(null);
      }
    },
    [selectedRoom]
  );

  /**
   * 建立 WebSocket 连接
   */
  const connectToRoom = useCallback((roomId) => {
    if (!roomId) return null;
    console.log(`[Lobby] Connecting to room ${roomId}`);
    return websocketService.connect(roomId);
  }, []);

  /**
   * Effect A：只在组件挂载时执行一次，用来：
   *  - 获取用户名和房间列表
   *  - 建立全局的 websocketService 事件监听
   */
  useEffect(() => {
    fetchUsername();
    fetchRooms();

    // 订阅 websocketService 的全局事件（message/error/maxReconnectAttemptsReached）
    const unsubscribes = [
      websocketService.subscribe("message", ({ roomId, data }) => {
        if (data.type === "room_update") {
          console.log("Applying room update:", data);
          updateRoomData(roomId, data);
        }
      }),
      websocketService.subscribe("error", ({ roomId }) => {
        handleWebSocketError(roomId);
      }),
      websocketService.subscribe("maxReconnectAttemptsReached", (roomId) => {
        handleWebSocketError(roomId);
      }),
    ];

    // 卸载组件时清理事件订阅（但这里先不主动 disconnectAll, 避免无限重连循环）
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      // 如果你想在离开 Lobby 页面时，彻底断开所有 room，可以视需求添加:
      // websocketService.disconnectAll();
    };
    // 注意这里不依赖 createdRoomId，保证只执行一次
  }, [handleWebSocketError, updateRoomData]);

  /**
   * Effect B：监听 createdRoomId 一旦变化，就去连接（或断开旧的）
   * 如果一个用户可能会多次 createRoom，不想并发存在多条连接，可在此 effect return 里 disconnect(oldRoomId)。
   */
  useEffect(() => {
    if (createdRoomId) {
      const ws = connectToRoom(createdRoomId);
      // 如果需要在 “createdRoomId” 改变时自动断开旧连接，可以存一份 state 做比较。
      // 这里只在离开这个 effect时断开当前 roomId 的连接。
      return () => {
        console.log(`[Lobby] Disconnect from room ${createdRoomId}`);
        websocketService.disconnect(createdRoomId);
      };
    }
  }, [createdRoomId, connectToRoom]);

  /**
   * 创建房间成功后的回调
   */
  const handleRoomCreate = useCallback(
    async (roomId) => {
      try {
        console.log("Room created with ID:", roomId);

        // 先更新 state
        const newRoom = {
          room_id: roomId,
          players: [{ username, elo: 1500 }],
          ready: { [username]: false },
          started: false,
          match_id: null,
        };

        setRooms((prevRooms) => [...prevRooms, newRoom]);
        setSelectedRoom(newRoom);
        setCreatedRoomId(roomId);

        // 因为在 Effect B 里，一旦 createdRoomId 变了，就会 connectToRoom
        // 这里就不再写 connectToRoom(roomId) 了
        return roomId;
      } catch (err) {
        console.error("Error handling room creation:", err);
        handleWebSocketError(roomId);
        return null;
      }
    },
    [username, handleWebSocketError]
  );

  /**
   * 用户发起 “创建房间” 按钮
   */
  const handleCreateCustomGame = () => {
    setModalOpen(true);
    setIsCreator(true);
  };

  /**
   * 进入一个占位游戏
   */
  const handleJoinPlaceholder = () => {
    const placeholderMatchId = "placeholder-match";
    navigate(`/game/${placeholderMatchId}`);
  };

  /**
   * 进入“复盘室”
   */
  const handleGoToReviewRoom = () => {
    navigate("/review");
  };

  /**
   * 用户点击 “加入房间” 的处理
   */
  const handleJoinRoom = useCallback(
    async (roomId) => {
      try {
        console.log("Attempting to join room:", roomId);
        const targetRoom = rooms.find((r) => r.room_id === roomId);
        if (!targetRoom) {
          throw new Error("Room no longer exists");
        }
        if (targetRoom.players.some((p) => p.username === username)) {
          throw new Error("Cannot join your own room");
        }
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Please log in again");
        }
        setSelectedRoom(targetRoom);
        setIsCreator(false);
        setModalOpen(true);
        setCreatedRoomId(roomId);

        // WebSocket 连接会在 Effect B 里自动建立

        // 然后请求后端 join
        await axios.post(
          `${API_BASE_URL}/rooms/${roomId}/join`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("Successfully joined room");
      } catch (err) {
        console.error("Error joining room:", err);
        handleWebSocketError(roomId);
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "/login";
        } else {
          alert(
            "Failed to join room: " + (err.response?.data?.detail || err.message)
          );
        }
      }
    },
    [rooms, username, handleWebSocketError]
  );

  /**
   * 当关闭 Modal 时的回调
   * @param {boolean} shouldRefresh
   */
  const handleModalClose = useCallback(
    (shouldRefresh) => {
      setModalOpen(false);
      setSelectedRoom(null);
      setIsCreator(false);
      // 如果你要离开房间，也可以在这里 disconnect(createdRoomId)
      // 不过一般是点“leave room”之类按钮时再退房
      setCreatedRoomId(null);
      if (shouldRefresh) {
        fetchRooms();
      }
    },
    []
  );

  return (
    <div style={{ padding: 20 }}>
      <Typography variant="h4" gutterBottom>
        Lobby
      </Typography>

      <Paper style={{ padding: 16, marginBottom: 16 }}>
        <Typography variant="h6" gutterBottom>
          Welcome, {username}!
        </Typography>
        <Typography>
          This is the game lobby. Here you can create or join matches.
        </Typography>
      </Paper>

      <div style={{ marginBottom: 16 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateCustomGame}
          style={{ marginRight: 8 }}
        >
          Create Custom Game
        </Button>
        <Button variant="contained" onClick={handleJoinPlaceholder} style={{ marginRight: 8 }}>
          Join Placeholder Game
        </Button>
        <Button variant="contained" onClick={handleGoToReviewRoom}>
          Go to Review Room
        </Button>
      </div>

      <Paper style={{ padding: 16 }}>
        <Typography variant="body1" gutterBottom>
          Active Rooms:
        </Typography>
        {rooms.map((room) => (
          <Paper
            key={room.room_id}
            style={{
              padding: 8,
              margin: 8,
              border:
                selectedRoom?.room_id === room.room_id ? "2px solid #1976d2" : "none",
              backgroundColor:
                selectedRoom?.room_id === room.room_id ? "#f5f5f5" : "white",
            }}
          >
            <Typography>Room ID: {room.room_id}</Typography>
            <Typography>
              ELO Range: {room.eloMin} - {room.eloMax}
            </Typography>
            <Typography>
              Players: {room.players.map((p) => p.username).join(", ")}
            </Typography>
            <Typography>Started: {room.started ? "Yes" : "No"}</Typography>
            <Button
              variant="outlined"
              onClick={() => handleJoinRoom(room.room_id)}
              style={{ marginTop: 6, marginRight: 6 }}
              disabled={room.players.includes(username)}
            >
              Join
            </Button>
            {room.started && room.match_id && (
              <div style={{ marginTop: 8 }}>
                <Typography variant="body2" style={{ color: "green", marginBottom: 4 }}>
                  Game in progress
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => navigate(`/game/${room.match_id}`)}
                  style={{ marginTop: 4 }}
                >
                  GO TO GAME
                </Button>
              </div>
            )}
          </Paper>
        ))}
      </Paper>

      <RoomCreationModal
        open={modalOpen}
        onClose={handleModalClose}
        onCreate={handleRoomCreate}
        username={username}
        isCreator={isCreator}
        createdRoomId={createdRoomId}
        selectedRoom={selectedRoom}
      />
    </div>
  );
}

export default Lobby;
