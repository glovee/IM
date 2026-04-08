from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.models import IncidentSource, IncidentStatus, IncidentType, Team, User, AffectedSystem
from src.schemas import SourceRead, StatusRead, IncidentTypeRead, TeamRead, UserRead, AffectedSystemRead

router = APIRouter(prefix="/api/dict", tags=["dictionaries"])


def to_dict(obj, schema_cls):
    return schema_cls.model_validate(obj).model_dump(mode="json")


@router.get("/sources", response_model=list[SourceRead])
async def get_sources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IncidentSource).where(IncidentSource.is_active == True).order_by(IncidentSource.display_name)
    )
    items = result.scalars().all()
    return [to_dict(i, SourceRead) for i in items]


@router.get("/statuses", response_model=list[StatusRead])
async def get_statuses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IncidentStatus).where(IncidentStatus.is_active == True).order_by(IncidentStatus.sort_order)
    )
    items = result.scalars().all()
    return [to_dict(i, StatusRead) for i in items]


@router.get("/types", response_model=list[IncidentTypeRead])
async def get_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IncidentType).where(IncidentType.is_active == True).order_by(IncidentType.sort_order)
    )
    items = result.scalars().all()
    return [to_dict(i, IncidentTypeRead) for i in items]


@router.get("/teams", response_model=list[TeamRead])
async def get_teams(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Team).where(Team.is_active == True).order_by(Team.name)
    )
    items = result.scalars().all()
    return [to_dict(i, TeamRead) for i in items]


@router.get("/users", response_model=list[UserRead])
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.is_active == True).order_by(User.display_name)
    )
    items = result.scalars().all()
    return [to_dict(i, UserRead) for i in items]


@router.get("/affected-systems", response_model=list[AffectedSystemRead])
async def get_affected_systems(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AffectedSystem).where(AffectedSystem.is_active == True).order_by(AffectedSystem.display_name)
    )
    items = result.scalars().all()
    return [to_dict(i, AffectedSystemRead) for i in items]
