import { io } from "socket.io-client";
import { WEBSOCKET_BASE_URL } from "../config/config";

/**
 * SocketClient:
 * - 不再在 setupSocketListeners / setupGameSocketListeners 等处调用 socket.removeAllListeners()
 * - 避免在 React.StrictMode 或多次连接场景下把 "game_update" 等回调意外移除
 * - 其余业务逻辑和日志全部保留
 */

class SocketClient {
  constructor() {
    if (SocketClient.instance) {
      return SocketClient.instance;
    }
    this.sockets = new Map();
    this.eventListeners = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.roomId = null;
    this.matchId = null;
    this.connectingPromises = new Map();

    this.lobbySocket = null;
    this.lobbyConnecting = false;
    this.lobbyConnected = false;
    this.lobbyReconnectAttempt = 0;

    SocketClient.instance = this;
  }

  static getInstance() {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  async connectToLobby() {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (!token || !username) {
      console.error("[SocketClient] connectToLobby => No token or username");
      return null;
    }
    if (this.lobbyConnected && this.lobbySocket?.connected) {
      return this.lobbySocket;
    }
    if (this.lobbyConnecting) {
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (this.lobbyConnected && this.lobbySocket?.connected) {
            clearInterval(checkConnection);
            resolve(this.lobbySocket);
          }
        }, 100);
      });
    }
    this.lobbyConnecting = true;
    try {
      const newSocket = io(WEBSOCKET_BASE_URL, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
        timeout: 10000,
        multiplex: false,
      });
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          newSocket.close();
          reject(new Error("Lobby connection timeout"));
        }, 5000);
        newSocket.once("connect", () => {
          clearTimeout(t);
          resolve();
        });
        newSocket.once("connect_error", (error) => {
          clearTimeout(t);
          newSocket.close();
          reject(error);
        });
      });
      this.lobbySocket = newSocket;
      this.lobbyConnected = true;
      this.lobbyReconnectAttempt = 0;
      this.setupLobbySocketListeners(newSocket);

      newSocket.emit("join_lobby", { username });
      setTimeout(() => {
        if (newSocket.connected) {
          newSocket.emit("message", { type: "get_rooms" });
        }
      }, 100);

      return newSocket;
    } catch (err) {
      console.error("[SocketClient] connectToLobby => Failed:", err);
      this.lobbyConnected = false;
      this.lobbySocket = null;
      return null;
    } finally {
      this.lobbyConnecting = false;
    }
  }

  setupLobbySocketListeners(socket) {
    socket.on("connect", () => {
      this.lobbyConnected = true;
      this.lobbyReconnectAttempt = 0;
      const connectCallbacks = this.eventListeners.get("connect") || [];
      connectCallbacks.forEach((cb) => cb());
    });
    socket.on("disconnect", (reason) => {
      this.lobbyConnected = false;
      const disconnectCallbacks = this.eventListeners.get("disconnect") || [];
      disconnectCallbacks.forEach((cb) => cb(reason));
      if (
        reason !== "io client disconnect" &&
        reason !== "io server disconnect"
      ) {
        if (this.lobbyReconnectAttempt < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.connectToLobby().catch(console.error);
          }, this.reconnectDelay);
          this.lobbyReconnectAttempt++;
        }
      }
    });
    socket.on("lobby_update", (data) => {
      const cbs = this.eventListeners.get("lobby_update") || [];
      cbs.forEach((cb) => cb(data));
    });
    socket.on("connect_error", (error) => {
      console.error("[SocketClient] Lobby connection error:", error);
      this.handleError({ roomId: "lobby", error });
    });
  }

  async connect(roomId) {
    if (roomId === "lobby") {
      return this.connectToLobby();
    }
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (!token || !username) {
      console.error("[SocketClient] connect => no token or username");
      return null;
    }
    if (this.connectingPromises.has(roomId)) {
      return this.connectingPromises.get(roomId);
    }
    try {
      const promise = this._createConnection(roomId);
      this.connectingPromises.set(roomId, promise);
      const socket = await promise;
      this.connectingPromises.delete(roomId);
      return socket;
    } catch (err) {
      this.connectingPromises.delete(roomId);
      console.error("[SocketClient] connect => fail for room:", roomId, err);
      return null;
    }
  }

  async _createConnection(roomId) {
    try {
      // 如果之前有socket，则先断开
      const existingSocket = this.sockets.get(roomId);
      if (existingSocket) {
        // 不再 removeAllListeners(); 只简单断开
        existingSocket.disconnect();
        this.sockets.delete(roomId);
      }
      const token = localStorage.getItem("token");
      const newSocket = io(WEBSOCKET_BASE_URL, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
        timeout: 10000,
        multiplex: false,
      });
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          newSocket.close();
          reject(new Error("Connection timeout"));
        }, 5000);
        newSocket.once("connect", () => {
          clearTimeout(t);
          resolve();
        });
        newSocket.once("connect_error", (error) => {
          clearTimeout(t);
          newSocket.close();
          reject(error);
        });
      });
      this.sockets.set(roomId, newSocket);
      this.reconnectAttempts.set(roomId, 0);
      this.setupSocketListeners(roomId, newSocket);
      return newSocket;
    } catch (err) {
      throw err;
    }
  }

  setupSocketListeners(roomId, socket) {
    socket.on("connect", () => {
      console.log("[SocketClient] Socket connected for room:", roomId);
      this.reconnectAttempts.set(roomId, 0);
      socket.io.engine.on("transportChange", (transport) => {
        console.log(
          "[SocketClient] roomId=",
          roomId,
          ", transport change =>",
          transport.name
        );
      });
      const connectCbs = this.eventListeners.get("connect") || [];
      connectCbs.forEach((cb) => cb());
    });
    // 不在此处 removeAllListeners(); 仅添加on
    socket.on("connect_error", (error) => {
      console.error("[SocketClient] Connection error for room:", roomId, error);
      this.handleError({ roomId, error });
    });
    socket.on("disconnect", (reason) => {
      console.log("[SocketClient] Socket disconnected for room:", roomId, reason);
      const discCbs = this.eventListeners.get("disconnect") || [];
      discCbs.forEach((cb) => cb(reason));
      this.handleDisconnect(roomId, reason);
    });
    socket.on("message", (data) => {
      console.log("[SocketClient] Received message for room:", roomId, data);
      const msgCbs = this.eventListeners.get("message") || [];
      msgCbs.forEach((cb) => cb({ roomId, data }));
    });
    socket.on("room_update", (data) => {
      console.log("[SocketClient] Received room_update for room:", roomId, data);
      const cbs = this.eventListeners.get("room_update") || [];
      cbs.forEach((cb) => cb(data));
    });
    socket.on("lobby_update", (data) => {
      console.log("[SocketClient] Received lobby_update for room:", roomId, data);
      const cbs = this.eventListeners.get("lobby_update") || [];
      cbs.forEach((cb) => cb(data));
    });
    // 不再 removeAllListeners(); 仅添加on
    socket.on("game_update", (data) => {
      console.log("[SocketClient] Received game_update for room:", roomId, data);
      console.log("[SocketClient] Socket details:", {
        id: socket.id,
        connected: socket.connected,
        disconnected: socket.disconnected,
      });

      const cbs = this.eventListeners.get("game_update") || [];
      if (cbs.length === 0) {
        console.warn("[SocketClient] No handlers registered for game_update");
        return;
      }
      cbs.forEach((cb, index) => {
        try {
          console.log(`[SocketClient] Executing game_update callback ${index + 1}`);
          cb(data);
        } catch (err) {
          console.error("[SocketClient] Error in game_update handler:", err);
        }
      });
    });
    socket.on("game_error", (data) => {
      console.error("[SocketClient] Received game_error for room:", roomId, data);
      const cbs = this.eventListeners.get("game_error") || [];
      cbs.forEach((cb) => cb(data));
    });
  }

  async connectToGame(matchId) {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (!token || !username) {
      console.error("[SocketClient] connectToGame => no token/username");
      return null;
    }
    console.log("[SocketClient] connectToGame => matchId:", matchId);

    // 如果已有并已连接，则复用
    if (this.sockets.has(matchId) && this.sockets.get(matchId).connected) {
      console.log("[SocketClient] connectToGame => reusing existing socket");
      const existingSocket = this.sockets.get(matchId);
      existingSocket.emit("joinGame", { match_id: matchId, username });
      return existingSocket;
    }

    // 若有旧 socket，先断开
    if (this.sockets.has(matchId)) {
      console.log("[SocketClient] connectToGame => cleaning up old socket");
      const oldSocket = this.sockets.get(matchId);
      // 不再 removeAllListeners(); 仅简单断开
      oldSocket.disconnect();
      this.sockets.delete(matchId);
    }

    try {
      const newSocket = io(WEBSOCKET_BASE_URL, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 10000,
        multiplex: false,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
      });

      await new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          newSocket.close();
          reject(new Error("Connection timeout"));
        }, 5000);

        newSocket.once("connect", () => {
          console.log("[SocketClient] connectToGame => socket connected");
          clearTimeout(t);
          resolve();
        });

        newSocket.once("connect_error", (error) => {
          console.error("[SocketClient] connectToGame => connection error:", error);
          clearTimeout(t);
          newSocket.close();
          reject(error);
        });
      });

      // 重连逻辑
      newSocket.on("disconnect", (reason) => {
        console.log("[SocketClient] Game socket disconnected:", reason);
        if (
          reason !== "io server disconnect" &&
          reason !== "io client disconnect"
        ) {
          setTimeout(() => {
            if (!newSocket.connected) {
              newSocket.connect();
            }
          }, this.reconnectDelay);
        }
      });

      this.sockets.set(matchId, newSocket);
      this.reconnectAttempts.set(matchId, 0);
      this.matchId = matchId;

      // 不再 removeAllListeners(); 仅设置监听器
      newSocket.onAny((eventName, ...args) => {
        console.log(`[SocketClient] Raw event received: ${eventName}`, args);
      });
      this.setupGameSocketListeners(matchId, newSocket);

      // 加入对应房间
      await newSocket.emit("join", `game_${matchId}`);
      await newSocket.emit("joinGame", { match_id: matchId, username });

      console.log("[SocketClient] connectToGame => setup complete, socket joined room game_" + matchId);
      return newSocket;
    } catch (err) {
      console.error("[SocketClient] connectToGame => fail:", err);
      return null;
    }
  }

  // 仅添加监听，不做 removeAllListeners()
  setupGameSocketListeners(matchId, socket) {
    console.log("[SocketClient] Setting up game socket listeners for match:", matchId);

    socket.on("connect", () => {
      console.log("[SocketClient] Game socket connected for match:", matchId);
      this.reconnectAttempts.set(matchId, 0);

      const username = localStorage.getItem("username") || "unknownUser";
      console.log("[SocketClient] Joining game after connect:", matchId);
      socket.emit("joinGame", { match_id: matchId, username });

      const connectCbs = this.eventListeners.get("connect") || [];
      connectCbs.forEach((cb) => cb());
    });

    socket.on("disconnect", (reason) => {
      console.log("[SocketClient] Game socket disconnected:", reason);
      const discCbs = this.eventListeners.get("disconnect") || [];
      discCbs.forEach((cb) => cb(reason));
      this.handleDisconnect(matchId, reason);
    });

    socket.on("connect_error", (error) => {
      console.error("[SocketClient] game connection error:", error);
      this.handleError({ matchId, error });
    });

    socket.on("game_update", (data) => {
      console.log("[SocketClient] Received game_update for match:", matchId);
      const cbs = this.eventListeners.get("game_update") || [];
      if (cbs.length === 0) {
        console.warn("[SocketClient] No handlers registered for game_update");
        return;
      }
      cbs.forEach((cb, index) => {
        try {
          console.log(`[SocketClient] Executing callback ${index + 1} for game_update`);
          cb(data);
        } catch (err) {
          console.error("[SocketClient] Error in game_update handler:", err);
        }
      });
    });
    console.log("[SocketClient] Game socket listeners setup complete for match:", matchId);
  }

  handleServerRestart() {
    if (this.lobbySocket) {
      this.lobbySocket.removeAllListeners();
      this.lobbySocket.disconnect();
      this.lobbySocket.close();
      this.lobbySocket = null;
      this.lobbyConnected = false;
      this.lobbyConnecting = false;
      this.lobbyReconnectAttempt = 0;
    }
    this.sockets.forEach((sock, id) => {
      sock.disconnect();
      sock.close();
    });
    this.sockets.clear();
    this.reconnectAttempts.clear();
    this.connectingPromises.clear();
    this.roomId = null;
    this.matchId = null;
  }

  handleDisconnect(id, reason) {
    this.sockets.delete(id);
    this.reconnectAttempts.delete(id);
    if (id === "lobby") {
      this.lobbyConnected = false;
    }
    if (
      reason !== "io client disconnect" &&
      reason !== "io server disconnect"
    ) {
      const curAttempt = this.reconnectAttempts.get(id) || 0;
      if (curAttempt < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.connect(id).catch((err) => {
            if (err.message?.includes("xhr poll error")) {
              this.handleServerRestart();
            } else {
              console.error("[SocketClient] Reconnect fail for", id, err);
            }
          });
        }, this.reconnectDelay);
        this.reconnectAttempts.set(id, curAttempt + 1);
      }
    }
  }

  handleError(error) {
    const callbacks = this.eventListeners.get("error") || [];
    callbacks.forEach((cb) => cb(error));
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const arr = this.eventListeners.get(event) || [];
    const idx = arr.indexOf(callback);
    if (idx !== -1) {
      arr.splice(idx, 1);
    }
  }

  sendMessage(message) {
    console.log("[SocketClient] sendMessage =>", message);
    if (message.type === "room_update") {
      const sock = this.sockets.get(message.room_id);
      if (sock && sock.connected) {
        sock.emit("message", {
          type: "room_update",
          room_id: message.room_id,
          data: message.data,
        });
      } else {
        console.error("[SocketClient] No active socket for room:", message.room_id);
      }
    } else {
      // 其他消息 => 发给所有活动连接 + lobby
      this.sockets.forEach((sock) => {
        if (sock && sock.connected) {
          sock.emit("message", message);
        }
      });
      if (this.lobbySocket && this.lobbySocket.connected) {
        this.lobbySocket.emit("message", message);
      }
    }
  }

  pullRoomInfo(roomId) {
    console.log(
      "[SocketClient] pullRoomInfo => requesting real data for roomId:",
      roomId
    );
    this.sendMessage({
      type: "pull_room_info",
      room_id: roomId,
    });
  }

  disconnect(id = null) {
    if (id) {
      if (id === "lobby") {
        if (this.lobbySocket) {
          // 保留 removeAllListeners() 只用于“真正退出lobby”情况
          this.lobbySocket.removeAllListeners();
          this.lobbySocket.disconnect();
          this.lobbySocket.close();
          this.lobbySocket = null;
          this.lobbyConnected = false;
          this.lobbyConnecting = false;
          this.lobbyReconnectAttempt = 0;
        }
      } else {
        const sock = this.sockets.get(id);
        if (sock) {
          // 不再 removeAllListeners(); 只做 simple disconnect
          sock.disconnect();
          sock.close();
          this.sockets.delete(id);
          this.reconnectAttempts.delete(id);
        }
      }
    } else {
      // 全部断开
      if (this.lobbySocket) {
        this.lobbySocket.removeAllListeners();
        this.lobbySocket.disconnect();
        this.lobbySocket.close();
        this.lobbySocket = null;
        this.lobbyConnected = false;
        this.lobbyConnecting = false;
        this.lobbyReconnectAttempt = 0;
      }
      this.sockets.forEach((sock, key) => {
        sock.disconnect();
        sock.close();
      });
      this.sockets.clear();
      this.reconnectAttempts.clear();
      this.roomId = null;
      this.matchId = null;
    }
  }

  getRooms() {
    this.sendMessage({ type: "get_rooms" });
  }

  createRoom(config, username) {
    this.sendMessage({
      type: "create_room",
      config,
      username,
    });
  }

  async joinRoom(roomId) {
    console.log("[SocketClient] joinRoom =>", roomId);
    const username = localStorage.getItem("username");
    const sock = await this.connect(roomId);
    if (!sock) {
      console.error("[SocketClient] joinRoom => Failed to connect to room:", roomId);
      return;
    }
    if (roomId === "lobby") {
      sock.emit("join_lobby", { username });
    } else {
      sock.emit("join_custom_room", { room_id: roomId, username });
      this.pullRoomInfo(roomId);
    }
  }

  leaveRoom(roomId) {
    console.log("[SocketClient] leaveRoom =>", roomId);
    const sock = this.sockets.get(roomId);
    if (sock && sock.connected) {
      sock.emit("leave_room", { room_id: roomId });
    }
  }

  async sendMove(matchId, x, y) {
    console.log("[SocketClient] sendMove => matchId:", matchId, "position:", x, y);
    const result = await this.sendGameAction(matchId, "move_stone", { x, y });
    console.log("[SocketClient] sendMove => result:", result);
    return result;
  }

  async sendGameAction(matchId, action, data = {}) {
    console.log("[SocketClient] sendGameAction =>", { matchId, action, data });
    let sock = this.sockets.get(matchId);
    if (!sock || !sock.connected) {
      console.log("[SocketClient] No active socket, attempting to reconnect...");
      sock = await this.connectToGame(matchId);
      if (!sock) {
        console.error("[SocketClient] Failed to establish connection for action:", action);
        return;
      }
    }
    if (sock.connected) {
      switch (action) {
        case "move_stone":
          console.log("[SocketClient] Emitting move_stone =>", {
            match_id: matchId,
            ...data,
          });
          sock.emit("move_stone", {
            match_id: matchId,
            ...data,
          });
          console.log("[SocketClient] move_stone emitted");
          break;
        case "pass":
          sock.emit("message", {
            type: "game_update",
            match_id: matchId,
            action: "pass",
          });
          break;
        case "resign":
          sock.emit("resign", {
            match_id: matchId,
            ...data,
          });
          break;
        case "confirm_scoring":
          sock.emit("confirm_scoring", {
            match_id: matchId,
            ...data,
          });
          break;
        case "mark_dead_stone":
          sock.emit("mark_dead_stone", {
            match_id: matchId,
            ...data,
          });
          break;
        case "export_sgf":
          sock.emit("message", {
            type: "game_update",
            match_id: matchId,
            action: "export_sgf",
          });
          break;
        default:
          console.error("[SocketClient] Unknown game action:", action);
          return;
      }
    } else {
      console.error(
        "[SocketClient] Socket still not connected after reconnection attempt"
      );
    }
  }
}

const socketClient = new SocketClient();

// 注意：保持现有 emit 逻辑和日志，去掉对 'gameUpdate' 的引用，只保留 'game_update'
socketClient.emit = function (event, data) {
  console.log("[SocketClient] emit => event:", event, "data:", data);
  
  // lobby或room_update
  if (data?.type === "get_rooms" || event === "join_lobby") {
    if (this.lobbySocket && this.lobbySocket.connected) {
      this.lobbySocket.emit(event, data);
      return;
    }
    this.connectToLobby().then(sock => {
      if (sock) {
        sock.emit(event, data);
      }
    });
    return;
  }
  if (data?.type === "room_update" && data.room_id) {
    const sock = this.sockets.get(data.room_id);
    if (sock && sock.connected) {
      sock.emit(event, {
        type: "room_update",
        room_id: data.room_id,
        data: data.data
      });
    } else {
      console.error("[SocketClient] emit => no active socket for room:", data.room_id);
    }
    return;
  }

  let emitted = false;
  this.sockets.forEach(sock => {
    if (sock && sock.connected) {
      sock.emit(event, data);
      emitted = true;
    }
  });
  if (this.lobbySocket && this.lobbySocket.connected) {
    this.lobbySocket.emit(event, data);
    emitted = true;
  }
  if (!emitted) {
    console.error("[SocketClient] emit => No active sockets to emit:", event);
  }
};

export default socketClient;
