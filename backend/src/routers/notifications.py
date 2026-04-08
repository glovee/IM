from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.models import UserNotification
from src.schemas import NotificationRead

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserNotification)
        .where(UserNotification.user_id == user_id)
        .order_by(UserNotification.created_at.desc())
    )
    items = result.scalars().all()
    return [NotificationRead.model_validate(n).model_dump(mode="json") for n in items]


@router.put("/{notification_id}/read", response_model=NotificationRead)
async def mark_read(notification_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserNotification).where(UserNotification.id == notification_id))
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    await db.commit()
    await db.refresh(n)
    return NotificationRead.model_validate(n).model_dump(mode="json")


@router.put("/read-all", response_model=dict)
async def mark_all_read(user_id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import update as sql_update
    await db.execute(
        sql_update(UserNotification)
        .where(UserNotification.user_id == user_id, UserNotification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked read"}
