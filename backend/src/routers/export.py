from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import io
import csv

from src.database import get_db
from src.models.models import Incident, IncidentFile, User, IncidentStatus, IncidentType, IncidentSource

router = APIRouter(prefix="/api/export", tags=["export"])


def _serialize_incident(incident: Incident, status_name=None, type_name=None, source_name=None, assignee_name=None):
    return {
        "id": str(incident.id),
        "title": incident.title,
        "host": incident.host,
        "login": incident.login,
        "date": incident.date.isoformat() if incident.date else "",
        "status": status_name or "",
        "type": type_name or "",
        "source": source_name or "",
        "assignee": assignee_name or "",
        "priority": incident.priority or "",
        "description": incident.description or "",
        "needs_escalation": incident.needs_escalation,
    }


@router.get("/incidents-csv")
async def export_incidents_csv(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            Incident,
            IncidentStatus.display_name.label("status_name"),
            IncidentType.name.label("type_name"),
            IncidentSource.display_name.label("source_name"),
            User.display_name.label("assignee_name"),
        )
        .outerjoin(IncidentStatus, Incident.status_id == IncidentStatus.id)
        .outerjoin(IncidentType, Incident.incident_type_id == IncidentType.id)
        .outerjoin(IncidentSource, Incident.source_id == IncidentSource.id)
        .outerjoin(User, Incident.assignee_id == User.id)
        .where(Incident.deleted_at.is_(None))
        .order_by(Incident.date.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Название", "Хост", "Нарушитель", "Дата", "Статус", "Тип", "Источник", "Ответственный", "Приоритет", "Описание"])
    for row in rows:
        inc = row.Incident
        writer.writerow([
            str(inc.id), inc.title, inc.host, inc.login,
            inc.date.isoformat() if inc.date else "",
            row.status_name or "", row.type_name or "", row.source_name or "", row.assignee_name or "",
            inc.priority or "", inc.description or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=incidents.csv"},
    )


@router.get("/incidents/{incident_id}/files")
async def export_incident_files(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IncidentFile).where(IncidentFile.incident_id == incident_id).order_by(IncidentFile.uploaded_at.desc())
    )
    files = result.scalars().all()
    return [
        {"id": str(f.id), "file_name": f.file_name, "file_size": f.file_size, "uploaded_at": f.uploaded_at.isoformat()}
        for f in files
    ]


@router.get("/incidents/{incident_id}/card")
async def export_incident_card(incident_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            Incident,
            IncidentStatus.display_name.label("status_name"),
            IncidentType.name.label("type_name"),
            IncidentSource.display_name.label("source_name"),
            User.display_name.label("assignee_name"),
        )
        .outerjoin(IncidentStatus, Incident.status_id == IncidentStatus.id)
        .outerjoin(IncidentType, Incident.incident_type_id == IncidentType.id)
        .outerjoin(IncidentSource, Incident.source_id == IncidentSource.id)
        .outerjoin(User, Incident.assignee_id == User.id)
        .where(Incident.id == incident_id, Incident.deleted_at.is_(None))
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _serialize_incident(row.Incident, row.status_name, row.type_name, row.source_name, row.assignee_name)


@router.get("/by-violator")
async def export_by_violator(login: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Incident)
        .where(Incident.login == login, Incident.deleted_at.is_(None))
        .order_by(Incident.date.desc())
    )
    incidents = result.scalars().all()
    return [{"id": str(i.id), "title": i.title, "date": i.date.isoformat() if i.date else ""} for i in incidents]
