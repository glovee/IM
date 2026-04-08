from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.models import IncidentType
from src.schemas import IncidentTypeCreate, IncidentTypeUpdate, IncidentTypeRead

router = APIRouter(prefix="/api/incident-types", tags=["incident-types"])


@router.get("", response_model=list[IncidentTypeRead])
async def list_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IncidentType).where(IncidentType.is_active == True).order_by(IncidentType.sort_order)
    )
    return [IncidentTypeRead.model_validate(t).model_dump(mode="json") for t in result.scalars().all()]


@router.post("", response_model=IncidentTypeRead, status_code=201)
async def create_type(data: IncidentTypeCreate, db: AsyncSession = Depends(get_db)):
    t = IncidentType(**data.model_dump(exclude={"field_ids"}))
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return IncidentTypeRead.model_validate(t).model_dump(mode="json")


@router.put("/{type_id}", response_model=IncidentTypeRead)
async def update_type(type_id: str, data: IncidentTypeUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IncidentType).where(IncidentType.id == type_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Incident type not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    await db.commit()
    await db.refresh(t)
    return IncidentTypeRead.model_validate(t).model_dump(mode="json")


@router.delete("/{type_id}")
async def delete_type(type_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IncidentType).where(IncidentType.id == type_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Incident type not found")
    t.is_active = False
    await db.commit()
    return {"message": "Incident type deleted"}
