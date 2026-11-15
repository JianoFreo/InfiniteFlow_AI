"""Real ffmpeg: seeking to a chunk must land on exactly the right frame (no duplicate, no gap at seams).
Skipped when ffmpeg isn't installed; runs inside the engine Docker image."""
import shutil
import subprocess
from fractions import Fraction

import numpy as np
import pytest

from app.ffmpeg_io import FrameReader, FrameWriter
from app.flow import BlendInterpolator
from app.pipeline import ChunkTask, process_chunk

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")

FPS = Fraction(30000, 1001)  # NTSC rate: the classic source of off-by-one seek bugs
W, H = 160, 96


@pytest.fixture(scope="module")
def clip(tmp_path_factory):
    path = tmp_path_factory.mktemp("clip") / "src.mp4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=size={W}x{H}:rate=30000/1001:duration=6",
         "-c:v", "libx264", "-g", "250", "-pix_fmt", "yuv420p", str(path)],
        check=True,
    )
    return str(path)


def decode(clip, start, count):
    reader = FrameReader(clip, start, count, FPS, W, H)
    frames = [f.copy() for f in reader]
    reader.close()
    return frames


def test_chunk_seek_matches_full_decode(clip):
    full = decode(clip, 0, 10_000)
    assert len(full) == 180
    for start in (1, 59, 60, 61, 119, 120, 179):
        chunk = decode(clip, start, 3)
        for offset, frame in enumerate(chunk):
            assert np.array_equal(frame, full[start + offset]), f"frame {start + offset} differs after seek"


def test_reading_past_the_end_returns_fewer_frames(clip):
    assert len(decode(clip, 170, 50)) == 10
    assert decode(clip, 400, 5) == []


def test_process_chunk_writes_expected_frame_count(clip, tmp_path):
    out = tmp_path / "chunk.mp4"
    task = ChunkTask(1, 0, clip, 60, 60, False, 4, "blend", "30000/1001", W, H, str(out))
    result = process_chunk(task, BlendInterpolator())
    assert result.frames_done == 60 and result.frames_written == 240
    count = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
         "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(out)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    assert int(count) == 240
    assert not (tmp_path / "chunk.mp4.part").exists()


def test_writer_pads_odd_dimensions(tmp_path):
    out = tmp_path / "odd.mp4"
    writer = FrameWriter(str(out), 99, 51, Fraction(30), "ultrafast", 30)
    for _ in range(5):
        writer.write(np.zeros((51, 99, 3), np.uint8))
    writer.close()
    assert out.stat().st_size > 0
