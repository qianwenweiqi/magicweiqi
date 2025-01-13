import { EventEmitter } from 'events';

class WebSocketService {
  constructor() {
    this.connections = new Map(); // roomId -> WebSocket
    this.eventEmitter = new EventEmitter();
    this.reconnectAttempts = new Map(); // roomId -> attempts
    this.maxReconnectAttempts = 5;
    this.reconnectTimeouts = new Map(); // roomId -> timeout
    this.baseReconnectDelay = 1000; // 1 second
    this.lastMessageTimestamp = new Map(); // roomId -> timestamp
    this.messageDebounceTime = 100; // 100ms debounce time
  }

  connect(roomId) {
    // 检查是否已经达到最大重连次数
    const attempts = this.reconnectAttempts.get(roomId) || 0;
    if (attempts >= this.maxReconnectAttempts) {
      console.log(`[WebSocketService] Max reconnection attempts reached for room ${roomId}`);
      this.eventEmitter.emit('maxReconnectAttemptsReached', roomId);
      this.cleanup(roomId);
      return null;
    }

    // 检查是否有token，如果没有则不连接
    const token = localStorage.getItem("token");
    if (!token) {
      console.log(`[WebSocketService] No token available, cannot connect to room ${roomId}`);
      return null;
    }

    // 检查现有连接
    const existingWs = this.connections.get(roomId);
    if (existingWs && existingWs.readyState === WebSocket.OPEN) {
      console.log(`[WebSocketService] Already connected to room ${roomId}`);
      return existingWs;
    }

    // 清理现有连接
    if (existingWs) {
      console.log(`[WebSocketService] Cleaning up existing connection for room ${roomId}`);
      this.cleanup(roomId);
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = window.location.port === '3000' ? '8000' : window.location.port;
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/rooms/${roomId}`;

    console.log(`[WebSocketService] Connecting to ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl);
      this.connections.set(roomId, ws);
      this.lastMessageTimestamp.set(roomId, 0);

      ws.onopen = () => {
        console.log(`[WebSocketService] Connected to room ${roomId}`);
        this.reconnectAttempts.set(roomId, 0);
        this.eventEmitter.emit('connected', roomId);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const now = Date.now();
          const lastTimestamp = this.lastMessageTimestamp.get(roomId) || 0;
          
          // Debounce messages
          if (now - lastTimestamp > this.messageDebounceTime) {
            console.log(`[WebSocketService] Received message for room ${roomId}:`, data);
            this.lastMessageTimestamp.set(roomId, now);
            this.eventEmitter.emit('message', { roomId, data });
          } else {
            console.log(`[WebSocketService] Debounced message for room ${roomId}`);
          }
        } catch (error) {
          console.error('[WebSocketService] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error(`[WebSocketService] WebSocket error for room ${roomId}:`, error);
        this.eventEmitter.emit('error', { roomId, error: new Error('WebSocket connection error') });
      };

      ws.onclose = () => {
        console.log(`[WebSocketService] Connection closed for room ${roomId}`);
        const currentWs = this.connections.get(roomId);
        // Only handle reconnect if this is still the current connection
        if (currentWs === ws) {
          this.connections.delete(roomId);
          this.handleReconnect(roomId);
        }
      };

      return ws;
    } catch (error) {
      console.error(`[WebSocketService] Error creating WebSocket for room ${roomId}:`, error);
      this.eventEmitter.emit('error', { roomId, error: new Error('Failed to create WebSocket connection') });
      return null;
    }
  }

  handleReconnect(roomId) {
    const attempts = (this.reconnectAttempts.get(roomId) || 0) + 1;
    this.reconnectAttempts.set(roomId, attempts);
    
    if (attempts >= this.maxReconnectAttempts) {
      console.log(`[WebSocketService] Max reconnection attempts reached for room ${roomId}`);
      this.eventEmitter.emit('maxReconnectAttemptsReached', roomId);
      this.cleanup(roomId);
      return;
    }

    // 检查是否有token，如果没有则不重连
    const token = localStorage.getItem("token");
    if (!token) {
      console.log(`[WebSocketService] No token available, stopping reconnection for room ${roomId}`);
      this.cleanup(roomId);
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, attempts - 1); // Exponential backoff
    console.log(`[WebSocketService] Attempting to reconnect to room ${roomId} in ${delay}ms (attempt ${attempts}/${this.maxReconnectAttempts})`);

    // Clear any existing timeout
    const existingTimeout = this.reconnectTimeouts.get(roomId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.connect(roomId);
    }, delay);

    this.reconnectTimeouts.set(roomId, timeout);
  }

  disconnect(roomId) {
    console.log(`[WebSocketService] Disconnecting from room ${roomId}`);
    const ws = this.connections.get(roomId);
    if (ws) {
      ws.close();
    }
    this.cleanup(roomId);
  }

  cleanup(roomId) {
    console.log(`[WebSocketService] Cleaning up room ${roomId}`);
    const ws = this.connections.get(roomId);
    if (ws) {
      // 移除所有事件监听器
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;

      if (ws.readyState !== WebSocket.CLOSED) {
        try {
          ws.close();
        } catch (error) {
          console.error(`[WebSocketService] Error closing WebSocket for room ${roomId}:`, error);
        }
      }
    }
    
    this.connections.delete(roomId);
    this.reconnectAttempts.delete(roomId);
    this.lastMessageTimestamp.delete(roomId);
    
    const timeout = this.reconnectTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(roomId);
    }
  }

  subscribe(event, callback) {
    this.eventEmitter.on(event, callback);
    return () => this.eventEmitter.off(event, callback);
  }

  disconnectAll() {
    console.log('[WebSocketService] Disconnecting all connections');
    for (const [roomId, ws] of this.connections) {
      ws.close();
      this.cleanup(roomId);
    }
  }
}

// Create a singleton instance
const websocketService = new WebSocketService();
export default websocketService;
