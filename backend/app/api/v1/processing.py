import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.job import JobCreateResponse, JobResponse
from app.services.job_service import create_video_job, get_downloadable_output_path, get_video_job

router = APIRouter(tags=["processing"])


@router.post("/upload", response_model=JobCreateResponse)
async def upload_video(
    interpolation_factor: int = 2,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    job = create_video_job(db, file, interpolation_factor)
    return JobCreateResponse(id=job.id, status=job.status.value)


@router.get("/status/{job_id}", response_model=JobResponse)
def job_status(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = get_video_job(db, job_id)
    output_url = f"/download/{job.id}" if job.status.value == "completed" and job.output_path else None

    return JobResponse(
        id=job.id,
        status=job.status.value,
        interpolation_factor=job.interpolation_factor,
        progress=job.progress,
        error_message=job.error_message,
        created_at=job.created_at,
        output_ready=job.status.value == "completed" and bool(job.output_path),
        output_url=output_url,
    )


@router.get("/download/{job_id}")
def download_video(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = get_video_job(db, job_id)
    output_path = get_downloadable_output_path(job)
    return FileResponse(path=output_path, filename=output_path.name, media_type="video/mp4")
