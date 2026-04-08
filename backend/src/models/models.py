import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text,
    Table, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.models.base import Base


# ============================================================
# Helper
# ============================================================

def uuid_pk() -> str:
    return str(uuid.uuid4())


# ============================================================
# Справочники
# ============================================================

class IncidentSource(Base):
    __tablename__ = "incident_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(150), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")


class IncidentStatus(Base):
    __tablename__ = "incident_statuses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")


class IncidentType(Base):
    __tablename__ = "incident_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")


class AffectedSystem(Base):
    __tablename__ = "affected_systems"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(150), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")


class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    name = Column(String(150), unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    username = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(200), nullable=False)
    email = Column(String(255))
    role = Column(String(50))
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")

    team = relationship("Team")


# ============================================================
# Основная таблица инцидентов
# ============================================================

incident_affected_systems = Table(
    "incident_affected_systems", Base.metadata,
    Column("incident_id", UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), primary_key=True),
    Column("affected_system_id", UUID(as_uuid=True), ForeignKey("affected_systems.id", ondelete="CASCADE"), primary_key=True),
)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)

    # Базовые поля
    title = Column(String(300), nullable=False)
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    source_id = Column(UUID(as_uuid=True), ForeignKey("incident_sources.id", ondelete="RESTRICT"))
    host = Column(String(255), nullable=False)
    login = Column(String(100), nullable=False)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"))
    status_id = Column(UUID(as_uuid=True), ForeignKey("incident_statuses.id", ondelete="RESTRICT"))
    date = Column(DateTime(timezone=True), nullable=False)

    # Тип
    incident_type_id = Column(UUID(as_uuid=True), ForeignKey("incident_types.id", ondelete="RESTRICT"))

    # Дополнительные поля
    priority = Column(String(20))  # critical, high, medium, low
    detected_at = Column(DateTime(timezone=True))
    description = Column(Text)
    response_time = Column(Integer)  # минуты
    needs_escalation = Column(Boolean, default=False)

    # Мета
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # soft delete

    # Relationships
    assignee = relationship("User", foreign_keys=[assignee_id])
    source = relationship("IncidentSource")
    team = relationship("Team")
    status = relationship("IncidentStatus")
    incident_type = relationship("IncidentType")
    affected_systems = relationship("AffectedSystem", secondary=incident_affected_systems)
    files = relationship("IncidentFile", back_populates="incident", order_by="IncidentFile.uploaded_at.desc()")
    investigation_entries = relationship("InvestigationEntry", back_populates="incident",
                                        order_by="InvestigationEntry.created_at.asc()")


class IncidentFile(Base):
    __tablename__ = "incident_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")

    incident = relationship("Incident", back_populates="files")


class IncidentCustomField(Base):
    __tablename__ = "incident_custom_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    field_key = Column(String(100), nullable=False)
    field_type = Column(String(20), nullable=False)
    value_text = Column(Text)
    value_number = Column(Numeric)
    value_boolean = Column(Boolean)
    value_datetime = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")

    __table_args__ = (
        UniqueConstraint("incident_id", "field_key"),
    )


class InvestigationEntry(Base):
    __tablename__ = "investigation_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False)  # comment, email_out, email_in
    parent_id = Column(UUID(as_uuid=True), ForeignKey("investigation_entries.id", ondelete="CASCADE"))
    thread_root_id = Column(UUID(as_uuid=True), ForeignKey("investigation_entries.id", ondelete="CASCADE"))
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    recipient = Column(String(255))
    subject = Column(String(500))
    template_name = Column(String(200))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")

    incident = relationship("Incident", back_populates="investigation_entries")
    author = relationship("User")


class UserNotification(Base):
    __tablename__ = "user_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default="NOW()")
