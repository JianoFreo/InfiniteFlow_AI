from __future__ import annotations

import os
from pathlib import Path

from redis import Redis
from rq import Connection, Queue, Worker
from sqlalchemy import create_engine, text

from app.config import DATABASE_URL, OUTPUTS_DIR, QUEUE_NAME, REDIS_URL, TMP_DIR
from app.ffmpeg_utils import mux_audio
from app.interpolation import interpolate_video


engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def _update_job(job_id: str, status: str, output_path: str | None = None, error_message: str | None = None) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE jobs
                SET status = :status,
                    output_path = :output_path,
                    error_message = :error_message,
                    updated_at = NOW()
                WHERE id = CAST(:job_id AS uuid)
                """
            ),
            {
                "job_id": job_id,
                "status": status,
                "output_path": output_path,
                "error_message": error_message,
            },
        )


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

    _update_job(job_id, "processing")

    source_path = Path(".")
    factor = 2

    try:
        source_path, factor = _get_job_input(job_id)
        if not source_path.exists():
            raise RuntimeError(f"Source file missing: {source_path}")

        silent_output = Path(TMP_DIR) / f"{job_id}_silent.mp4"
        final_output = Path(OUTPUTS_DIR) / f"{job_id}.mp4"

        interpolate_video(source_path, silent_output, factor)
        mux_audio(source_path, silent_output, final_output)

        _update_job(job_id, "completed", output_path=str(final_output), error_message=None)
    except Exception as exc:
        _update_job(job_id, "failed", output_path=None, error_message=str(exc))
        raise


def run() -> None:
    redis_conn = Redis.from_url(REDIS_URL)
    with Connection(redis_conn):
        worker = Worker([Queue(QUEUE_NAME)])
        worker.work()


if __name__ == "__main__":
    run()
