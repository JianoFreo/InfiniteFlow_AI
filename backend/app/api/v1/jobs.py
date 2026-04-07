import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.job import JobStatus
from app.schemas.job import JobCreateResponse, JobOptions, JobResponse
from app.services.job_service import cancel_video_job, create_video_job, get_downloadable_output_path, get_video_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _build_download_url(job_id: uuid.UUID, status: str, output_path: str | None) -> str | None:
    if status != JobStatus.completed or not output_path:
        return None
    return f"{settings.api_prefix}/jobs/{job_id}/download"


@router.post("", response_model=JobCreateResponse)
async def create_job(
    interpolation_factor: int = 2,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    opts = JobOptions(interpolation_factor=interpolation_factor)
    job = create_video_job(db, file, opts.interpolation_factor)
    return JobCreateResponse(id=job.id, status=job.status.value)


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = get_video_job(db, job_id)

    return JobResponse(
        id=job.id,
        status=job.status.value,
        interpolation_factor=job.interpolation_factor,
        progress=job.progress,
        error_message=job.error_message,
        created_at=job.created_at,
        output_ready=job.status == JobStatus.completed and bool(job.output_path),
        output_url=_build_download_url(job.id, job.status, job.output_path),
    )


@router.get("/{job_id}/download")
def download_job_output(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = get_video_job(db, job_id)
    output_path = get_downloadable_output_path(job)

    return FileResponse(path=output_path, filename=output_path.name, media_type="video/mp4")


@router.post("/{job_id}/cancel", response_model=JobResponse)
def cancel_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = cancel_video_job(db, job_id)
    return JobResponse(
        id=job.id,
        status=job.status.value,
        interpolation_factor=job.interpolation_factor,
        progress=job.progress,
        error_message=job.error_message,
        created_at=job.created_at,
        output_ready=job.status == JobStatus.completed and bool(job.output_path),
        output_url=_build_download_url(job.id, job.status, job.output_path),
    )
