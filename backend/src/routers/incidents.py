from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db
from src.models.models import (
    Incident, IncidentFile, IncidentCustomField, InvestigationEntry,
    incident_affected_systems, AffectedSystem,
    IncidentStatus, IncidentSource, IncidentType, Team, User,
)
from src.schemas import (
    IncidentCreate, IncidentUpdate, IncidentRead, IncidentBrief,
    IncidentFileRead, InvestigationEntryRead, MessageResponse
)
from src.websocket_manager import manager

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentBrief])
async def list_incidents(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Список инцидентов (без deleted)."""
    stmt = (
        select(
            Incident.id,
            Incident.title,
            Incident.host,
            Incident.login,
            Incident.date,
            Incident.priority,
            Incident.created_at,
            IncidentStatus.display_name.label("status_name"),
            IncidentType.name.label("type_name"),
            IncidentSource.display_name.label("source_name"),
            User.display_name.label("assignee_name"),
            Team.name.label("team_name"),
        )
        .outerjoin(IncidentStatus, Incident.status_id == IncidentStatus.id)
        .outerjoin(IncidentType, Incident.incident_type_id == IncidentType.id)
        .outerjoin(IncidentSource, Incident.source_id == IncidentSource.id)
        .outerjoin(User, Incident.assignee_id == User.id)
        .outerjoin(Team, Incident.team_id == Team.id)
        .where(Incident.deleted_at.is_(None))
        .order_by(Incident.date.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        IncidentBrief(
            id=row.id,
            title=row.title,
            host=row.host,
            login=row.login,
            date=row.date,
            priority=row.priority,
            status_name=row.status_name,
            type_name=row.type_name,
            source_name=row.source_name,
            assignee_name=row.assignee_name,
            team_name=row.team_name,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/all-with-details", response_model=list[dict])
async def list_incidents_with_details(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Список инцидентов с вложенными записями расследования (для инициализации collaboration)."""
    # Сначала получаем базовый список
    stmt = (
        select(Incident)
        .where(Incident.deleted_at.is_(None))
        .order_by(Incident.date.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    incidents = result.scalars().all()

    # Для каждого инцидента подгружаем investigation entries
    output = []
    for inc in incidents:
        entries_stmt = (
            select(InvestigationEntry, User.display_name, User.role)
            .join(User, InvestigationEntry.author_id == User.id)
            .where(InvestigationEntry.incident_id == inc.id)
            .order_by(InvestigationEntry.created_at.asc())
        )
        entries_result = await db.execute(entries_stmt)
        entries = [
            {
                "id": str(e.id),
                "incidentId": str(e.incident_id),
                "type": e.type,
                "parentId": str(e.parent_id) if e.parent_id else None,
                "threadRootId": str(e.thread_root_id) if e.thread_root_id else None,
                "authorId": str(e.author_id),
                "authorName": name,
                "authorRole": role or "",
                "content": e.content,
                "createdAt": e.created_at.isoformat(),
                "recipient": e.recipient,
                "subject": e.subject,
                "templateName": e.template_name,
            }
            for e, name, role in entries_result.all()
        ]
        output.append({
            "id": str(inc.id),
            "investigation": entries,
        })

    return output


@router.get("/{incident_id}", response_model=IncidentRead)
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    """Детальная информация об инциденте."""
    stmt = (
        select(
            Incident,
            IncidentStatus.display_name.label("status_name"),
            IncidentType.name.label("type_name"),
            IncidentType.code.label("type_code"),
            IncidentSource.display_name.label("source_name"),
            User.display_name.label("assignee_name"),
            Team.name.label("team_name"),
        )
        .outerjoin(IncidentStatus, Incident.status_id == IncidentStatus.id)
        .outerjoin(IncidentType, Incident.incident_type_id == IncidentType.id)
        .outerjoin(IncidentSource, Incident.source_id == IncidentSource.id)
        .outerjoin(User, Incident.assignee_id == User.id)
        .outerjoin(Team, Incident.team_id == Team.id)
        .where(Incident.id == incident_id, Incident.deleted_at.is_(None))
    )
    from src.models.models import Team
    result = await db.execute(stmt)
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident: Incident = row.Incident

    # Файлы
    files_stmt = select(IncidentFile).where(IncidentFile.incident_id == incident_id).order_by(IncidentFile.uploaded_at.desc())
    files_result = await db.execute(files_stmt)
    files = files_result.scalars().all()

    # Затронутые системы
    systems = incident.affected_systems

    # Расследование
    entries_stmt = (
        select(InvestigationEntry, User.display_name, User.role)
        .join(User, InvestigationEntry.author_id == User.id)
        .where(InvestigationEntry.incident_id == incident_id)
        .order_by(InvestigationEntry.created_at.asc())
    )
    entries_result = await db.execute(entries_stmt)
    entries = [
        InvestigationEntryRead(
            id=e.id,
            type=e.type,
            author_id=e.author_id,
            author_name=name,
            author_role=role,
            content=e.content,
            parent_id=e.parent_id,
            thread_root_id=e.thread_root_id,
            recipient=e.recipient,
            subject=e.subject,
            template_name=e.template_name,
            created_at=e.created_at,
        )
        for e, name, role in entries_result.all()
    ]

    return IncidentRead(
        id=incident.id,
        title=incident.title,
        host=incident.host,
        login=incident.login,
        date=incident.date,
        source_id=incident.source_id,
        status_id=incident.status_id,
        incident_type_id=incident.incident_type_id,
        assignee_id=incident.assignee_id,
        team_id=incident.team_id,
        priority=incident.priority,
        detected_at=incident.detected_at,
        description=incident.description,
        response_time=incident.response_time,
        needs_escalation=incident.needs_escalation,
        created_by=incident.created_by,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        status_name=row.status_name,
        type_name=row.type_name,
        type_code=row.type_code,
        source_name=row.source_name,
        assignee_name=row.assignee_name,
        team_name=row.team_name,
        affected_systems=[
            {"id": s.id, "name": s.name, "display_name": s.display_name}
            for s in systems
        ],
        files=[
            IncidentFileRead(
                id=f.id, file_name=f.file_name, file_path=f.file_path,
                file_size=f.file_size, mime_type=f.mime_type, uploaded_at=f.uploaded_at,
            )
            for f in files
        ],
        investigation_entries=entries,
    )


@router.post("", response_model=IncidentRead, status_code=201)
async def create_incident(data: IncidentCreate, db: AsyncSession = Depends(get_db)):
    """Создать инцидент."""
    incident = Incident(**data.model_dump(exclude={"affected_system_ids"}))
    db.add(incident)
    await db.flush()

    # Затронутые системы
    if data.affected_system_ids:
        stmt = select(AffectedSystem).where(AffectedSystem.id.in_(data.affected_system_ids))
        result = await db.execute(stmt)
        systems = result.scalars().all()
        incident.affected_systems = list(systems)

    await db.commit()
    await db.refresh(incident)

    # Получить полную информацию для ответа
    stmt = (
        select(
            Incident,
            IncidentStatus.display_name.label("status_name"),
            IncidentType.name.label("type_name"),
            IncidentType.code.label("type_code"),
            IncidentSource.display_name.label("source_name"),
            User.display_name.label("assignee_name"),
            Team.name.label("team_name"),
        )
        .outerjoin(IncidentStatus, Incident.status_id == IncidentStatus.id)
        .outerjoin(IncidentType, Incident.incident_type_id == IncidentType.id)
        .outerjoin(IncidentSource, Incident.source_id == IncidentSource.id)
        .outerjoin(User, Incident.assignee_id == User.id)
        .outerjoin(Team, Incident.team_id == Team.id)
        .where(Incident.id == incident.id)
    )
    result = await db.execute(stmt)
    row = result.one()

    obj = IncidentRead(
        id=incident.id,
        title=incident.title,
        host=incident.host,
        login=incident.login,
        date=incident.date,
        source_id=incident.source_id,
        status_id=incident.status_id,
        incident_type_id=incident.incident_type_id,
        assignee_id=incident.assignee_id,
        team_id=incident.team_id,
        priority=incident.priority,
        detected_at=incident.detected_at,
        description=incident.description,
        response_time=incident.response_time,
        needs_escalation=incident.needs_escalation,
        created_by=incident.created_by,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        status_name=row.status_name,
        type_name=row.type_name,
        type_code=row.type_code,
        source_name=row.source_name,
        assignee_name=row.assignee_name,
        team_name=row.team_name,
    )

    # Broadcast через WebSocket
    await manager.broadcast({
        "type": "incident_created",
        "data": obj.model_dump(mode="json"),
    })

    return obj


@router.put("/{incident_id}", response_model=IncidentRead)
async def update_incident(incident_id: str, data: IncidentUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить инцидент."""
    stmt = select(Incident).where(Incident.id == incident_id, Incident.deleted_at.is_(None))
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    update_data = data.model_dump(exclude_unset=True, exclude={"affected_system_ids"})
    for field, value in update_data.items():
        setattr(incident, field, value)

    if data.affected_system_ids is not None:
        stmt_sys = select(AffectedSystem).where(AffectedSystem.id.in_(data.affected_system_ids))
        res = await db.execute(stmt_sys)
        incident.affected_systems = list(res.scalars().all())

    await db.execute(text("UPDATE incidents SET updated_at = NOW() WHERE id = :id"), {"id": incident_id})

    await db.commit()
    await db.refresh(incident)

    # Получить полную информацию
    stmt_full = (
        select(
            Incident,
            IncidentStatus.display_name.label("status_name"),
            IncidentType.name.label("type_name"),
            IncidentType.code.label("type_code"),
            IncidentSource.display_name.label("source_name"),
            User.display_name.label("assignee_name"),
            Team.name.label("team_name"),
        )
        .outerjoin(IncidentStatus, Incident.status_id == IncidentStatus.id)
        .outerjoin(IncidentType, Incident.incident_type_id == IncidentType.id)
        .outerjoin(IncidentSource, Incident.source_id == IncidentSource.id)
        .outerjoin(User, Incident.assignee_id == User.id)
        .outerjoin(Team, Incident.team_id == Team.id)
        .where(Incident.id == incident.id)
    )
    result = await db.execute(stmt_full)
    row = result.one()

    obj = IncidentRead(
        id=incident.id,
        title=incident.title,
        host=incident.host,
        login=incident.login,
        date=incident.date,
        source_id=incident.source_id,
        status_id=incident.status_id,
        incident_type_id=incident.incident_type_id,
        assignee_id=incident.assignee_id,
        team_id=incident.team_id,
        priority=incident.priority,
        detected_at=incident.detected_at,
        description=incident.description,
        response_time=incident.response_time,
        needs_escalation=incident.needs_escalation,
        created_by=incident.created_by,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        status_name=row.status_name,
        type_name=row.type_name,
        type_code=row.type_code,
        source_name=row.source_name,
        assignee_name=row.assignee_name,
        team_name=row.team_name,
    )

    await manager.broadcast({
        "type": "incident_updated",
        "data": obj.model_dump(mode="json"),
    })

    return obj


@router.delete("/{incident_id}", response_model=MessageResponse)
async def delete_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    """Soft delete (переместить в корзину)."""
    result = await db.execute(
        text("UPDATE incidents SET deleted_at = NOW() WHERE id = :id RETURNING id"),
        {"id": incident_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")

    await db.commit()

    await manager.broadcast({
        "type": "incident_deleted",
        "data": {"id": incident_id},
    })

    return {"message": "Incident deleted"}
