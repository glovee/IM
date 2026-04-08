from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from src.database import engine
from src.models.base import Base
from src.routers import incidents, dictionaries, investigation, teams, incident_types_api, notifications, export, files
from src.schemas import MessageResponse
from src.websocket_manager import manager


# ============================================================
# Lifespan — инициализация БД
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создание таблиц при старте (если ещё не существуют)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[DB] Tables created (if not exists)")
    yield
    await engine.dispose()


# ============================================================
# App
# ============================================================

app = FastAPI(
    title="Incident Management API",
    description="REST API + WebSocket для управления инцидентами безопасности",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — разрешаем фронтенду
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роутеры
app.include_router(incidents.router)
app.include_router(dictionaries.router)
app.include_router(investigation.router)
app.include_router(teams.router)
app.include_router(incident_types_api.router)
app.include_router(notifications.router)
app.include_router(export.router)
app.include_router(files.router)


# ============================================================
# WebSocket endpoint — real-time обновления таблицы инцидентов
# ============================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket для real-time обновлений.

    При подключждении клиент получает `{"type": "connected"}`.
    При любом CRUD событии инцидентов приходит:
      - {"type": "incident_created", "data": {...}}
      - {"type": "incident_updated", "data": {...}}
      - {"type": "incident_deleted", "data": {"id": "..."}}
      - {"type": "investigation_entry_created", "data": {...}}
    """
    await manager.connect(websocket)
    try:
        while True:
            # Сервер слушает — можно принимать команды от клиента
            # (пока просто игнорируем, основная логика — broadcast от REST)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ============================================================
# Health
# ============================================================

@app.get("/health", response_model=MessageResponse, tags=["system"])
async def health():
    return {"message": "ok"}
