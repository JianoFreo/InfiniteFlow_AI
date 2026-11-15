"""Processing one chunk: decode → interpolate → encode.

How chunk boundaries stay seamless
----------------------------------
A chunk owns source frames [start, start + frame_count). To create the in-betweens after its LAST
frame it also needs the NEXT chunk's first frame, so the reader decodes frame_count + 1 frames
(only frame_count for the last chunk of the video). Output per chunk:

    for every owned frame i that has a partner i+1:  frame i, then (factor - 1) new frames
    the very last frame of the video:                 just itself

Concatenating all chunks in order gives exactly (N - 1) * factor + 1 frames, identical to
processing the whole video in one go. tests/test_pipeline.py checks this.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from fractions import Fraction
from typing import Callable, Iterable

import numpy as np

from app.ffmpeg_io import FrameReader, FrameWriter
from app.flow import Interpolator


class Cancelled(Exception):
    """The job was cancelled while this chunk was running."""


@dataclass(frozen=True)
class ChunkTask:
    job_id: int
    chunk_index: int
    source_path: str
    start_frame: int
    frame_count: int
    last: bool
    factor: int
    mode: str
    fps: str
    width: int
    height: int
    output_path: str

    @classmethod
    def from_message(cls, data: dict) -> "ChunkTask":
        """Builds a task from job-service's JSON (camelCase keys)."""
        task = cls(
            job_id=int(data["jobId"]),
            chunk_index=int(data["chunkIndex"]),
            source_path=str(data["sourcePath"]),
            start_frame=int(data["startFrame"]),
            frame_count=int(data["frameCount"]),
            last=bool(data["last"]),
            factor=int(data["factor"]),
            mode=str(data.get("mode") or "flow"),
            fps=str(data["fps"]),
            width=int(data["width"]),
            height=int(data["height"]),
            output_path=str(data["outputPath"]),
        )
        if not 2 <= task.factor <= 8:
            raise ValueError("factor must be between 2 and 8")
        if task.frame_count < 1 or task.start_frame < 0:
            raise ValueError("invalid frame range")
        return task


@dataclass(frozen=True)
class ChunkResult:
    frames_done: int
    frames_written: int
    output_path: str | None


def interpolate_frames(
    frames: Iterable[np.ndarray],
    chunk_len: int,
    factor: int,
    interpolator: Interpolator,
    emit: Callable[[np.ndarray], None],
    progress: Callable[[int], None] | None = None,
    should_stop: Callable[[], bool] | None = None,
) -> int:
    """Core loop, free of ffmpeg and RabbitMQ so it can be unit tested. Returns source frames finished."""
    it = iter(frames)
    prev = next(it, None)
    if prev is None:
        return 0  # nothing left in the video for this chunk

    done = 0
    for cur in it:
        if should_stop is not None and should_stop():
            raise Cancelled()
        emit(prev)
        for middle in interpolator.between(prev, cur, factor):
            emit(middle)
        done += 1
        if progress is not None:
            progress(done)
        prev = cur
        if done >= chunk_len:
            return done  # `cur` was the look-ahead frame; it belongs to the next chunk

    # The stream ended: `prev` is the final frame of the whole video and has no partner.
    emit(prev)
    done += 1
    if progress is not None:
        progress(done)
    return done


def process_chunk(
    task: ChunkTask,
    interpolator: Interpolator,
    progress: Callable[[int], None] | None = None,
    should_stop: Callable[[], bool] | None = None,
    x264_preset: str = "veryfast",
    x264_crf: int = 18,
    threads: int = 0,
) -> ChunkResult:
    fps = Fraction(task.fps)
    frames_needed = task.frame_count + (0 if task.last else 1)
    reader = FrameReader(task.source_path, task.start_frame, frames_needed, fps, task.width, task.height, threads)
    writer: FrameWriter | None = None

    def emit(frame: np.ndarray) -> None:
        nonlocal writer
        if writer is None:
            writer = FrameWriter(task.output_path, task.width, task.height, fps * task.factor, x264_preset, x264_crf, threads)
        writer.write(frame)

    try:
        done = interpolate_frames(reader, task.frame_count, task.factor, interpolator, emit, progress, should_stop)
        reader.close()
        if writer is None:
            return ChunkResult(0, 0, None)  # the estimate overshot the real frame count: empty chunk
        writer.close()
        return ChunkResult(done, writer.frames_written, task.output_path)
    except BaseException:
        reader.kill()
        if writer is not None:
            writer.abort()
        try:
            os.remove(task.output_path)
        except FileNotFoundError:
            pass
        raise
