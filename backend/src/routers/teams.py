from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.models import Team
from src.schemas import TeamCreate, TeamUpdate, TeamRead

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("", response_model=list[TeamRead])
async def list_teams(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).where(Team.is_active == True).order_by(Team.name))
    return [TeamRead.model_validate(t).model_dump(mode="json") for t in result.scalars().all()]


@router.post("", response_model=TeamRead, status_code=201)
async def create_team(data: TeamCreate, db: AsyncSession = Depends(get_db)):
    team = Team(**data.model_dump())
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return TeamRead.model_validate(team).model_dump(mode="json")


@router.put("/{team_id}", response_model=TeamRead)
async def update_team(team_id: str, data: TeamUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    await db.commit()
    await db.refresh(team)
    return TeamRead.model_validate(team).model_dump(mode="json")


@router.delete("/{team_id}")
async def delete_team(team_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    team.is_active = False
    await db.commit()
    return {"message": "Team deleted"}
