"""Read and write raw frames through ffmpeg pipes.

The old worker wrote every frame to disk as a JPEG, read it back, wrote the result as another JPEG,
and then encoded that. Here frames go straight from the ffmpeg decoder into NumPy and from NumPy
into the x264 encoder: no temp images, no quality loss. Decoding and encoding also run in their
own processes, so they use other CPU cores while Python computes the next frame.
"""
from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from fractions import Fraction
from typing import Iterable, Iterator

import numpy as np

log = logging.getLogger("engine.ffmpeg")

# A frame starts this far (in frames) after the seek point. Seeking slightly BEFORE frame N keeps
# timestamp rounding from dropping frame N, and still lands after frame N-1.
_SEEK_EPSILON_FRAMES = Fraction(1, 20)


def fraction_str(value: Fraction) -> str:
    return f"{value.numerator}/{value.denominator}"


# Clean-up steps a job can ask for. All are purely spatial (no state carried between frames), so every
# chunk of a job produces exactly the pixels a single-pass run would: chunk seams stay invisible.
PREPROCESS_FILTERS = {
    "denoise": "hqdn3d=3:2:0:0",   # spatial-only denoise; noise confuses optical flow
    "deband": "gradfun=1.2:16",    # smooths banding in gradients
    "sharpen": "unsharp=5:5:0.6:5:5:0.0",
}


def parse_preprocess(value: str | None) -> list[str]:
    """'denoise,sharpen' -> ['denoise', 'sharpen']. Unknown names raise ValueError."""
    steps = [s.strip() for s in (value or "").split(",") if s.strip()]
    unknown = [s for s in steps if s not in PREPROCESS_FILTERS]
    if unknown:
        raise ValueError(f"unknown preprocess step(s): {', '.join(unknown)}")
    return list(dict.fromkeys(steps))


def _read_text(handle) -> str:
    handle.seek(0)
    return handle.read().decode("utf-8", "replace").strip()


class FrameReader:
    """Decodes `count` frames starting at frame `start_frame` as BGR arrays of shape (height, width, 3)."""

    def __init__(self, path: str, start_frame: int, count: int, fps: Fraction, width: int, height: int,
                 threads: int = 0, preprocess: Iterable[str] = ()) -> None:
        self.width, self.height = width, height
        self.frame_bytes = width * height * 3
        self.frames_read = 0
        args = ["ffmpeg", "-v", "error", "-nostdin"]
        if start_frame > 0:
            # -ss before -i = fast keyframe seek, then ffmpeg decodes up to the exact time (accurate seek).
            seek = (start_frame - _SEEK_EPSILON_FRAMES) / fps
            args += ["-ss", f"{float(seek):.6f}"]
        if threads > 0:
            args += ["-threads", str(threads)]  # before -i = decoder threads
        args += [
            "-i", path,
            "-map", "0:v:0",
            "-frames:v", str(count),
            # Constant frame rate on the source grid, so "frame N" always means time N/fps,
            # even for phone videos with a slightly variable frame rate.
            "-r", fraction_str(fps),
            "-s", f"{width}x{height}",
            *(["-vf", ",".join(PREPROCESS_FILTERS[s] for s in preprocess)] if preprocess else []),
            "-pix_fmt", "bgr24",
            "-f", "rawvideo", "pipe:1",
        ]
        self._stderr = tempfile.TemporaryFile()
        self._proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=self._stderr, bufsize=self.frame_bytes)

    def __iter__(self) -> Iterator[np.ndarray]:
        stdout = self._proc.stdout
        while True:
            buf = bytearray(self.frame_bytes)
            view = memoryview(buf)
            got = 0
            while got < self.frame_bytes:
                n = stdout.readinto(view[got:])
                if not n:
                    break
                got += n
            if got < self.frame_bytes:
                return  # end of stream (a partial frame can only mean ffmpeg stopped)
            self.frames_read += 1
            yield np.frombuffer(buf, dtype=np.uint8).reshape(self.height, self.width, 3)

    def close(self) -> None:
        if self._proc.poll() is None:
            self._proc.stdout.close()
            try:
                self._proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._proc.kill()
                self._proc.wait()
        stderr = _read_text(self._stderr)
        self._stderr.close()
        if self._proc.returncode not in (0, None) and self.frames_read == 0:
            raise RuntimeError(f"ffmpeg could not decode the source: {stderr or self._proc.returncode}")
        if stderr:
            log.debug("decoder stderr: %s", stderr)

    def kill(self) -> None:
        if self._proc.poll() is None:
            self._proc.kill()
            self._proc.wait()
        self._stderr.close()


class FrameWriter:
    """Encodes BGR frames to an H.264 MP4. Writes to `<path>.part` and renames on success,
    so a half-written chunk is never mistaken for a finished one."""

    def __init__(self, path: str, width: int, height: int, fps: Fraction, preset: str, crf: int, threads: int = 0) -> None:
        self.path = path
        self.tmp_path = path + ".part"
        self.frames_written = 0
        os.makedirs(os.path.dirname(path), exist_ok=True)
        args = [
            "ffmpeg", "-v", "error", "-nostdin", "-y",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", fraction_str(fps),
            "-i", "pipe:0",
            # yuv420p needs even width/height; pad odd sizes by one pixel.
            "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p",
            *(["-threads", str(threads)] if threads > 0 else []),
            "-an", "-f", "mp4", self.tmp_path,
        ]
        self._stderr = tempfile.TemporaryFile()
        self._proc = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=self._stderr)

    def write(self, frame: np.ndarray) -> None:
        if not frame.flags["C_CONTIGUOUS"]:
            frame = np.ascontiguousarray(frame)
        self._proc.stdin.write(frame.data)
        self.frames_written += 1

    def close(self) -> None:
        self._proc.stdin.close()
        code = self._proc.wait()
        stderr = _read_text(self._stderr)
        self._stderr.close()
        if code != 0:
            self._remove_tmp()
            raise RuntimeError(f"ffmpeg encoder failed ({code}): {stderr}")
        os.replace(self.tmp_path, self.path)

    def abort(self) -> None:
        if self._proc.poll() is None:
            try:
                self._proc.stdin.close()
            except OSError:
                pass
            self._proc.kill()
            self._proc.wait()
        self._stderr.close()
        self._remove_tmp()

    def _remove_tmp(self) -> None:
        try:
            os.remove(self.tmp_path)
        except FileNotFoundError:
            pass
