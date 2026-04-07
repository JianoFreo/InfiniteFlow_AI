import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.job import Job, JobStatus
from app.schemas.job import JobOptions
from app.services.queue import retry_policy, video_queue
from app.tasks import VIDEO_PROCESS_TASK


def create_video_job(db: Session, file: UploadFile, interpolation_factor: int = 2) -> Job:
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
    db.refresh(job)

    video_queue.enqueue(VIDEO_PROCESS_TASK, str(job.id), job_timeout="30m", retry=retry_policy)
    return job


def get_video_job(db: Session, job_id: uuid.UUID) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def get_downloadable_output_path(job: Job) -> Path:
    if job.status != JobStatus.completed or not job.output_path:
        raise HTTPException(status_code=409, detail="Output not ready")

    output_path = Path(job.output_path)
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file missing")
    return output_path
