"""Process ONE chunk and exit. This is the only way the system runs the Python code.

Python here is pure computation: no queue, no network, no database. Everything around it (taking work
from RabbitMQ, retries, cancellation, progress reporting, talking to job-service) is done by the Java
interpolation-worker, which starts this module as a child process for each chunk:

    stdin   one JSON chunk task, the same camelCase fields job-service publishes:
            {"jobId": 7, "chunkIndex": 3, "sourcePath": "...", "startFrame": 144, "frameCount": 48,
             "last": false, "factor": 4, "mode": "flow", "fps": "24/1", "width": 1280, "height": 720,
             "outputPath": "/data/jobs/7/chunk_00003.mp4",
             "preprocess": "denoise,sharpen"}   (preprocess is optional: denoise, deband, sharpen)

    stdout  one JSON object per line, nothing else:
            {"event": "progress", "framesDone": 12}
            {"event": "done", "framesDone": 48, "framesWritten": 189, "outputPath": "/data/jobs/7/chunk_00003.mp4"}
            {"event": "cancelled"}
            {"event": "error", "message": "..."}

    stderr  human-readable logs and tracebacks (the worker copies them into its own log)

    exit    0 done · 1 processing error · 2 bad task · 3 cancelled

Cancelling: the worker sends SIGTERM. The flag is checked between frame pairs, so the chunk stops
within one pair, ffmpeg is shut down and the half-written output file is deleted.
"""
from __future__ import annotations

import json
import signal
import sys
import threading
import traceback
from typing import TextIO

from app import config
from app.flow import create_interpolator
from app.pipeline import Cancelled, ChunkTask, process_chunk

EXIT_DONE = 0
EXIT_ERROR = 1
EXIT_BAD_TASK = 2
EXIT_CANCELLED = 3

stop_requested = threading.Event()


def _emit(out: TextIO, **fields) -> None:
    out.write(json.dumps(fields) + "\n")
    out.flush()  # the worker reads line by line: never leave progress sitting in a buffer


def main(stdin: TextIO = sys.stdin, stdout: TextIO = sys.stdout) -> int:
    signal.signal(signal.SIGTERM, lambda *_: stop_requested.set())

    try:
        task = ChunkTask.from_message(json.load(stdin))
    except Exception as exc:  # noqa: BLE001 - anything wrong with the input is a bad task
        _emit(stdout, event="error", message=f"bad task: {exc}")
        return EXIT_BAD_TASK

    interpolator = create_interpolator(task.mode, config.FLOW_MAX_SIDE, config.FLOW_PRESET, config.SCENE_CUT_THRESHOLD)
    try:
        result = process_chunk(
            task,
            interpolator,
            progress=lambda frames_done: _emit(stdout, event="progress", framesDone=frames_done),
            should_stop=stop_requested.is_set,
            x264_preset=config.X264_PRESET,
            x264_crf=config.X264_CRF,
            threads=config.ENGINE_THREADS,
        )
    except Cancelled:
        _emit(stdout, event="cancelled")
        return EXIT_CANCELLED
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc(file=sys.stderr)
        _emit(stdout, event="error", message=str(exc)[:500])
        return EXIT_ERROR

    _emit(stdout, event="done", framesDone=result.frames_done, framesWritten=result.frames_written,
          outputPath=result.output_path)
    return EXIT_DONE


if __name__ == "__main__":
    sys.exit(main())
