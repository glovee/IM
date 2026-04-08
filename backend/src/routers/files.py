import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.models import IncidentFile, Incident

router = APIRouter(prefix="/api/incidents/{incident_id}/files", tags=["files"])

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("", status_code=201)
async def upload_file(incident_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    # Проверка что инцидент существует
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Incident not found")

    file_ext = os.path.splitext(file.filename or "")[1]
    unique_name = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    db_file = IncidentFile(
        incident_id=incident_id,
        file_name=file.filename or "unknown",
        file_path=file_path,
        file_size=len(content),
        mime_type=file.content_type,
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)

    return {"id": str(db_file.id), "file_name": db_file.file_name, "file_size": db_file.file_size}


@router.get("/{file_id}")
async def download_file(incident_id: str, file_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IncidentFile).where(IncidentFile.id == file_id))
    f = result.scalar_one_or_none()
    if not f or str(f.incident_id) != incident_id:
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.exists(f.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(f.file_path, filename=f.file_name)


@router.delete("/{file_id}")
async def delete_file(incident_id: str, file_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IncidentFile).where(IncidentFile.id == file_id))
    f = result.scalar_one_or_none()
    if not f or str(f.incident_id) != incident_id:
        raise HTTPException(status_code=404, detail="File not found")
    if f.file_path and os.path.exists(f.file_path):
        os.remove(f.file_path)
    await db.delete(f)
    await db.commit()
    return {"message": "File deleted"}
