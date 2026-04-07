import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from redis import Redis
from rq.command import send_stop_job_command
from rq.exceptions import NoSuchJobError
from rq.job import Job as RQJob
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

    video_queue.enqueue(
        VIDEO_PROCESS_TASK,
        str(job.id),
        job_timeout="30m",
        retry=retry_policy,
        job_id=str(job.id),
    )
    return job


def get_video_job(db: Session, job_id: uuid.UUID) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def list_video_jobs(db: Session, limit: int = 50, active_only: bool = False) -> list[Job]:
    safe_limit = max(1, min(200, int(limit)))
    query = db.query(Job)
    if active_only:
        query = query.filter(Job.status.in_((JobStatus.queued, JobStatus.processing)))
    return query.order_by(Job.created_at.desc()).limit(safe_limit).all()


def get_downloadable_output_path(job: Job) -> Path:
    if job.status != JobStatus.completed or not job.output_path:
        raise HTTPException(status_code=409, detail="Output not ready")

    output_path = Path(job.output_path)
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file missing")
    return output_path


def cancel_video_job(db: Session, job_id: uuid.UUID) -> Job:
    job = get_video_job(db, job_id)

    if job.status in (JobStatus.completed, JobStatus.failed):
        return job

    redis_conn = Redis.from_url(settings.redis_url)
    try:
        rq_job = RQJob.fetch(str(job.id), connection=redis_conn)
        rq_status = rq_job.get_status(refresh=True)
        if rq_status in ("queued", "deferred", "scheduled"):
            rq_job.cancel()
        elif rq_status == "started":
            send_stop_job_command(redis_conn, rq_job.id)
    except (NoSuchJobError, ValueError):
        pass

    job.status = JobStatus.failed
    job.error_message = "Cancelled by user"
    db.commit()
    db.refresh(job)
    return job
