from __future__ import annotations

import logging
import os
from pathlib import Path

from redis import Redis
from rq import Connection, Queue, Worker, get_current_job
from sqlalchemy import create_engine, text

from worker.app.config import DATABASE_URL, OUTPUTS_DIR, QUEUE_NAME, REDIS_URL, TMP_DIR
from worker.video_processor import process_video


engine = create_engine(DATABASE_URL, pool_pre_ping=True)
logger = logging.getLogger("video_worker")


def _setup_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def _update_job(job_id: str, status: str, output_path: str | None = None, error_message: str | None = None) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE jobs
                SET status = :status,
                    output_path = :output_path,
                    progress = :progress,
                    error_message = :error_message,
                    updated_at = NOW()
                WHERE id = CAST(:job_id AS uuid)
                """
            ),
            {
                "job_id": job_id,
                "status": status,
                "output_path": output_path,
                "progress": 0 if status in ("queued", "failed") else 100 if status == "completed" else 0,
                "error_message": error_message,
            },
        )


def _update_progress(job_id: str, progress: int) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE jobs
                SET progress = :progress,
                    updated_at = NOW()
                WHERE id = CAST(:job_id AS uuid)
                """
            ),
            {
                "job_id": job_id,
                "progress": max(0, min(100, int(progress))),
            },
        )


def _sync_rq_progress(job_id: str, progress: int) -> None:
    job = get_current_job()
    if job is None:
        return
    job.meta["progress"] = int(progress)
    job.meta["video_job_id"] = job_id
    job.save_meta()


def _get_job_input(job_id: str) -> tuple[Path, int]:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT source_path, interpolation_factor FROM jobs WHERE id = CAST(:job_id AS uuid)"),
            {"job_id": job_id},
        ).mappings().first()
    if row is None:
        raise RuntimeError(f"Job {job_id} not found")
    return Path(row["source_path"]), int(row["interpolation_factor"])


def process_video_job(job_id: str) -> None:
    Path(OUTPUTS_DIR).mkdir(parents=True, exist_ok=True)
    Path(TMP_DIR).mkdir(parents=True, exist_ok=True)

    rq_job = get_current_job()
    attempt = 1
    max_attempts = 1
    if rq_job is not None:
        attempt = rq_job.meta.get("attempt", 0) + 1
        rq_job.meta["attempt"] = attempt
        max_attempts = (rq_job.retries_left or 0) + attempt
        rq_job.save_meta()

    logger.info("job_start id=%s attempt=%s max_attempts=%s", job_id, attempt, max_attempts)

    _update_job(job_id, "processing", output_path=None, error_message=None)
    _update_progress(job_id, 0)
    _sync_rq_progress(job_id, 0)

    source_path = Path(".")
    factor = 2
    method = "linear"

    def on_progress(progress: int) -> None:
        _update_progress(job_id, progress)
        _sync_rq_progress(job_id, progress)

    try:
        source_path, factor = _get_job_input(job_id)
        if not source_path.exists():
            raise RuntimeError(f"Source file missing: {source_path}")

        final_output = Path(OUTPUTS_DIR) / f"{job_id}.mp4"
        method = os.getenv("INTERPOLATION_METHOD", "linear")

        process_video(
            input_video=source_path,
            output_video=final_output,
            factor=factor,
            method=method,
            keep_temp=False,
            temp_root=Path(TMP_DIR) / job_id,
            progress_callback=on_progress,
        )

        _update_job(job_id, "completed", output_path=str(final_output), error_message=None)
        _update_progress(job_id, 100)
        _sync_rq_progress(job_id, 100)
        logger.info("job_completed id=%s output=%s", job_id, final_output)
    except Exception as exc:
        logger.exception("job_failed id=%s attempt=%s error=%s", job_id, attempt, exc)
        retries_left = rq_job.retries_left if rq_job is not None else 0
        if retries_left and retries_left > 0:
            _update_job(job_id, "queued", output_path=None, error_message=f"Retry scheduled: {exc}")
            _update_progress(job_id, 0)
            _sync_rq_progress(job_id, 0)
            logger.warning("job_retry_scheduled id=%s retries_left=%s", job_id, retries_left)
        else:
            _update_job(job_id, "failed", output_path=None, error_message=str(exc))
        raise


def run() -> None:
    _setup_logging()
    redis_conn = Redis.from_url(REDIS_URL)
    with Connection(redis_conn):
        worker = Worker([Queue(QUEUE_NAME)])
        logger.info("worker_started queue=%s", QUEUE_NAME)
        worker.work()


if __name__ == "__main__":
    run()
