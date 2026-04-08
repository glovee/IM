import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Управление WebSocket подключениями и рассылка обновлений."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict[str, Any]):
        """Отправить сообщение всем подключённым клиентам."""
        message = json.dumps(data, default=str)
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_text(message)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.disconnect(d)

    async def send_personal(self, websocket: WebSocket, data: dict[str, Any]):
        """Отправить сообщение конкретному клиенту."""
        await websocket.send_text(json.dumps(data, default=str))


manager = ConnectionManager()
