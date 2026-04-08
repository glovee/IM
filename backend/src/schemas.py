from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# Базовые
# ============================================================

class BaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID


class MessageResponse(BaseModel):
    message: str


# ============================================================
# Справочники
# ============================================================

class SourceRead(BaseResponse):
    name: str
    display_name: str
    is_active: bool


class StatusRead(BaseResponse):
    name: str
    display_name: str
    sort_order: int


class IncidentTypeRead(BaseResponse):
    code: str
    name: str
    description: Optional[str]
    sort_order: int


class AffectedSystemRead(BaseResponse):
    name: str
    display_name: str


class TeamRead(BaseResponse):
    name: str
    description: Optional[str]


class UserRead(BaseResponse):
    username: str
    display_name: str
    email: Optional[str]
    role: Optional[str]


# ============================================================
# Incident — Create / Update
# ============================================================

class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    host: str = Field(..., min_length=1, max_length=255)
    login: str = Field(..., min_length=1, max_length=100)
    date: datetime
    source_id: UUID
    status_id: UUID
    incident_type_id: Optional[UUID] = None
    assignee_id: Optional[UUID] = None
    team_id: Optional[UUID] = None
    priority: Optional[str] = Field(None, pattern="^(critical|high|medium|low)$")
    detected_at: Optional[datetime] = None
    description: Optional[str] = None
    response_time: Optional[int] = None
    needs_escalation: bool = False
    affected_system_ids: list[UUID] = []


class IncidentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    host: Optional[str] = Field(None, min_length=1, max_length=255)
    login: Optional[str] = Field(None, min_length=1, max_length=100)
    date: Optional[datetime] = None
    source_id: Optional[UUID] = None
    status_id: Optional[UUID] = None
    incident_type_id: Optional[UUID] = None
    assignee_id: Optional[UUID] = None
    team_id: Optional[UUID] = None
    priority: Optional[str] = Field(None, pattern="^(critical|high|medium|low)$")
    detected_at: Optional[datetime] = None
    description: Optional[str] = None
    response_time: Optional[int] = None
    needs_escalation: Optional[bool] = None
    affected_system_ids: Optional[list[UUID]] = None


# ============================================================
# Incident — Read
# ============================================================

class IncidentFileRead(BaseResponse):
    file_name: str
    file_path: Optional[str]
    file_size: Optional[int]
    mime_type: Optional[str]
    uploaded_at: datetime


class InvestigationEntryRead(BaseResponse):
    type: str
    author_id: UUID
    author_name: str
    author_role: Optional[str]
    content: str
    parent_id: Optional[UUID]
    thread_root_id: Optional[UUID]
    recipient: Optional[str]
    subject: Optional[str]
    template_name: Optional[str]
    created_at: datetime


class IncidentRead(BaseResponse):
    title: str
    host: str
    login: str
    date: datetime
    source_id: UUID
    status_id: UUID
    incident_type_id: Optional[UUID]
    assignee_id: Optional[UUID]
    team_id: Optional[UUID]
    priority: Optional[str]
    detected_at: Optional[datetime]
    description: Optional[str]
    response_time: Optional[int]
    needs_escalation: bool
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    # Denormalised
    status_name: Optional[str] = None
    type_name: Optional[str] = None
    type_code: Optional[str] = None
    source_name: Optional[str] = None
    assignee_name: Optional[str] = None
    team_name: Optional[str] = None

    # Related
    affected_systems: list[AffectedSystemRead] = []
    files: list[IncidentFileRead] = []
    investigation_entries: list[InvestigationEntryRead] = []


class IncidentBrief(BaseModel):
    """Краткая версия для списка (без related-данных)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    host: str
    login: str
    date: datetime
    priority: Optional[str]
    status_name: Optional[str]
    type_name: Optional[str]
    source_name: Optional[str]
    assignee_name: Optional[str]
    team_name: Optional[str] = None
    created_at: datetime


# ============================================================
# WebSocket
# ============================================================

class WsIncidentEvent(BaseModel):
    type: str  # created | updated | deleted
    data: dict[str, Any]


# ============================================================
# Teams
# ============================================================

class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ============================================================
# Incident Types
# ============================================================

class IncidentTypeCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    sort_order: int = 0
    field_ids: list[str] = []


class IncidentTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    field_ids: Optional[list[str]] = None


# ============================================================
# Notifications
# ============================================================

class NotificationRead(BaseResponse):
    user_id: UUID
    incident_id: UUID
    title: str
    description: Optional[str]
    is_read: bool
    created_at: datetime


# ============================================================
# Investigation
# ============================================================

class InvestigationEntryCreate(BaseModel):
    incident_id: UUID
    author_id: UUID
    content: str
    type: str = Field(default="comment", pattern="^(comment|email_out|email_in)$")
    parent_id: Optional[UUID] = None
    thread_root_id: Optional[UUID] = None
    recipient: Optional[str] = None
    subject: Optional[str] = None
    template_name: Optional[str] = None
