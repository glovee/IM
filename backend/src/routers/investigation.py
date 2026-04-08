from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.models import InvestigationEntry, Incident, User
from src.schemas import InvestigationEntryCreate, InvestigationEntryRead
from src.websocket_manager import manager

router = APIRouter(prefix="/api/investigation", tags=["investigation"])


@router.post("/entries", response_model=InvestigationEntryRead, status_code=201)
async def create_entry(data: InvestigationEntryCreate, db: AsyncSession = Depends(get_db)):
    """Добавить запись расследования (комментарий / email out / email in)."""
    inc = await db.execute(select(Incident).where(Incident.id == data.incident_id))
    if not inc.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Incident not found")

    entry = InvestigationEntry(
        incident_id=data.incident_id,
        type=data.type,
        author_id=data.author_id,
        content=data.content,
        parent_id=data.parent_id,
        thread_root_id=data.thread_root_id,
        recipient=data.recipient,
        subject=data.subject,
        template_name=data.template_name,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    user_result = await db.execute(select(User).where(User.id == entry.author_id))
    user = user_result.scalar_one()

    obj = InvestigationEntryRead(
        id=entry.id,
        type=entry.type,
        author_id=entry.author_id,
        author_name=user.display_name,
        author_role=user.role,
        content=entry.content,
        parent_id=entry.parent_id,
        thread_root_id=entry.thread_root_id,
        recipient=entry.recipient,
        subject=entry.subject,
        template_name=entry.template_name,
        created_at=entry.created_at,
    )

    await manager.broadcast({
        "type": "investigation_entry_created",
        "data": {
            "incident_id": data.incident_id,
            **obj.model_dump(mode="json"),
        },
    })

    return obj


@router.get("/entries/{incident_id}", response_model=list[InvestigationEntryRead])
async def get_entries(incident_id: str, db: AsyncSession = Depends(get_db)):
    """Все записи расследования для инцидента."""
    stmt = (
        select(InvestigationEntry, User.display_name, User.role)
        .join(User, InvestigationEntry.author_id == User.id)
        .where(InvestigationEntry.incident_id == incident_id)
        .order_by(InvestigationEntry.created_at.asc())
    )
    result = await db.execute(stmt)
    return [
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
        for e, name, role in result.all()
    ]
