import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.job import Job, JobStatus
from app.schemas.job import JobCreateResponse, JobOptions, JobResponse
from app.services.queue import retry_policy, video_queue
from app.tasks import VIDEO_PROCESS_TASK

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _build_download_url(job: Job) -> str | None:
    if job.status != JobStatus.completed or not job.output_path:
        return None
    return f"{settings.api_prefix}/jobs/{job.id}/download"


@router.post("", response_model=JobCreateResponse)
async def create_job(
    interpolation_factor: int = 2,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    opts = JobOptions(interpolation_factor=interpolation_factor)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    job_id = uuid.uuid4()
    safe_name = f"{job_id}_{Path(file.filename).name}"
    upload_path = Path(settings.uploads_dir) / safe_name

    with upload_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    job = Job(
        id=job_id,
        source_path=str(upload_path),
        status=JobStatus.queued,
        interpolation_factor=opts.interpolation_factor,
        progress=0,
    )
    db.add(job)
    db.commit()

    video_queue.enqueue(VIDEO_PROCESS_TASK, str(job_id), job_timeout="30m", retry=retry_policy)

    return JobCreateResponse(id=job_id, status=JobStatus.queued.value)


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResponse(
        id=job.id,
        status=job.status.value,
        interpolation_factor=job.interpolation_factor,
        progress=job.progress,
        error_message=job.error_message,
        created_at=job.created_at,
        output_ready=job.status == JobStatus.completed and bool(job.output_path),
        output_url=_build_download_url(job),
    )


@router.get("/{job_id}/download")
def download_job_output(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.completed or not job.output_path:
        raise HTTPException(status_code=409, detail="Output not ready")

    output_path = Path(job.output_path)
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file missing")

    return FileResponse(path=output_path, filename=output_path.name, media_type="video/mp4")
