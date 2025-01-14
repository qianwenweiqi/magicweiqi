# backend/services/websocket_manager.py

import logging
import socketio
from typing import Dict, List

logger = logging.getLogger(__name__)

class SocketIOManager:
    def __init__(self):
        # active_connections: { room_id: [sid1, sid2, ...] }
        self.active_connections: Dict[str, List[str]] = {}
        # user_mapping: { sid -> username }
        self.user_mapping: Dict[str, str] = {}
        self.sio = socketio.AsyncServer(async_mode='asgi')
        self.clear_rooms()

    def clear_rooms(self):
        """
        服务器重启时清空所有内存中的房间->sid映射。
        """
        self.active_connections.clear()
        logger.info("All rooms cleared due to server restart")

    async def connect(self, room_id: str, sid: str, username: str=None):
        """
        用户 sid 加入某房间 room_id。
        如果同一个房间下，已存在同一username的旧SID，则断开旧SID——除非就是同一个sid。
        """
        if not username:
            username = f"guest-{sid[:6]}"

        existing_sid = None
        if room_id in self.active_connections:
            for s in self.active_connections[room_id]:
                # 如果发现已有相同username
                if self.user_mapping.get(s) == username:
                    existing_sid = s
                    break

        # ★★ 只在 existing_sid != sid 时才清理旧的，避免多 socket 相互踢掉 ★★
        if existing_sid and existing_sid != sid:
            logger.info(f"Found existing connection for user {username} in room {room_id}, cleaning up.")
            self.disconnect(room_id, existing_sid)

        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(sid)
        self.user_mapping[sid] = username

        logger.info(f"User {username} joined room {room_id}. Total: {len(self.active_connections[room_id])}")

    def disconnect(self, room_id: str, sid: str):
        """
        将指定 sid 从 room_id 中移除。
        若该房间空了，就保留一个空列表(避免后面还要再用？ 或直接删除也行，看项目需求)。
        如果该sid不在其它房间里，顺便把 user_mapping 里也清理掉。
        """
        username = self.user_mapping.get(sid, f"guest-{sid[:6]}")
        if room_id in self.active_connections:
            self.active_connections[room_id] = [
                s for s in self.active_connections[room_id] if s != sid
            ]
            if not self.active_connections[room_id]:
                # 这行可改成 del self.active_connections[room_id]，看需要
                self.active_connections[room_id] = []
                logger.info(f"Room {room_id} is now empty but kept")

            # 检查该 sid 是否还在别的房间
            user_in_other = any(
                sid in conns for r, conns in self.active_connections.items() if r != room_id
            )
            if not user_in_other and sid in self.user_mapping:
                del self.user_mapping[sid]
                logger.info(f"User {username} is completely disconnected")
            else:
                logger.info(f"User {username} disconnected from {room_id} but remains in other rooms")

    async def leave_room(self, room_id: str, sid: str):
        """
        用户主动离开某房间的逻辑。
        如果房间没人了，可向房间广播 room_deleted (看实际需求)。
        """
        if room_id in self.active_connections:
            self.active_connections[room_id] = [
                s for s in self.active_connections[room_id] if s != sid
            ]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                await self.send_message(room_id, {
                    "type":"room_deleted",
                    "room_id":room_id
                })
            username = self.user_mapping.get(sid, f"guest-{sid[:6]}")
            logger.info(f"User {username} left room {room_id}")

    def get_username_by_sid(self, sid: str) -> str:
        """
        帮助函数：给 sid 查 username
        """
        return self.user_mapping.get(sid)

    async def send_message(self, room_id: str, message: dict, target_sid: str=None):
        """
        向指定房间里的所有连接(or单个sid)发送事件。
        - 根据 message['type'] 确定事件名 => 'lobby_update' / 'room_update' / 'gameUpdate' / 'readyStateUpdate' ...
        - 如果 target_sid 不为空，则只发给该SID
        """
        if room_id not in self.active_connections:
            logger.warning(f"No active connections for room {room_id}")
            return

        msg_type = message.get('type')
        if msg_type == 'lobby_update':
            event_name = 'lobby_update'
        elif msg_type == 'room_update':
            event_name = 'room_update'
        elif msg_type == 'readyStateUpdate':
            event_name = 'readyStateUpdate'
        elif msg_type == 'game_update':
            event_name = 'game_update'
        else:
            # fallback
            event_name = 'gameUpdate'

        if target_sid:
            # 仅发给目标SID
            try:
                await self.sio.emit(event_name, message, to=target_sid)
                username = self.user_mapping.get(target_sid, f"guest-{target_sid[:6]}")
                logger.info(f"Message sent to user {username} in {room_id}, event={event_name}")
            except Exception as e:
                logger.error(f"Error sending message to {target_sid} in {room_id}: {e}")
                self.disconnect(room_id, target_sid)
        else:
            # 广播给房间内所有sid
            user_list = [
                self.user_mapping.get(s, f"guest-{s[:6]}")
                for s in self.active_connections[room_id]
            ]
            logger.info(f"Broadcasting to room {room_id}, active users: {', '.join(user_list)} with event {event_name}")
            disconnected = []
            for sid in self.active_connections[room_id]:
                try:
                    await self.sio.emit(event_name, message, to=sid)
                except Exception as e:
                    logger.error(f"Error sending to {sid} in room {room_id}: {e}")
                    disconnected.append(sid)
            for d in disconnected:
                self.disconnect(room_id, d)


# room_manager 专门管理 lobby / 自定义房间
room_manager = SocketIOManager()

# game_manager 专门管理对局(match)房间
game_manager = SocketIOManager()
