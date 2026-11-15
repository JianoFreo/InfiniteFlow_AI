"""The stdin/stdout contract between the Java interpolation-worker and the Python engine."""
import io
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from app import run_chunk

ENGINE_DIR = Path(__file__).resolve().parents[1]
needs_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


def events(text):
    return [json.loads(line) for line in text.splitlines()]


def task(clip, out, **overrides):
    base = {"jobId": 7, "chunkIndex": 0, "sourcePath": clip, "startFrame": 0, "frameCount": 12,
            "last": False, "factor": 2, "mode": "flow", "fps": "24/1", "width": 96, "height": 64,
            "outputPath": str(out)}
    return {**base, **overrides}


@pytest.fixture(autouse=True)
def reset_stop_flag():
    run_chunk.stop_requested.clear()
    yield
    run_chunk.stop_requested.clear()


@pytest.fixture(scope="module")
def clip(tmp_path_factory):
    if shutil.which("ffmpeg") is None:
        pytest.skip("ffmpeg not installed")
    path = tmp_path_factory.mktemp("clip") / "src.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=96x64:rate=24:duration=1",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path)], check=True)
    return str(path)


def test_bad_json_is_reported_as_bad_task():
    out = io.StringIO()
    assert run_chunk.main(io.StringIO("not json"), out) == run_chunk.EXIT_BAD_TASK
    [event] = events(out.getvalue())
    assert event["event"] == "error" and event["message"].startswith("bad task")


def test_invalid_factor_is_reported_as_bad_task(tmp_path):
    out = io.StringIO()
    payload = json.dumps(task("x.mp4", tmp_path / "o.mp4", factor=20))
    assert run_chunk.main(io.StringIO(payload), out) == run_chunk.EXIT_BAD_TASK


@needs_ffmpeg
def test_done_reports_progress_then_done(clip, tmp_path):
    out_file = tmp_path / "chunk.mp4"
    out = io.StringIO()
    assert run_chunk.main(io.StringIO(json.dumps(task(clip, out_file))), out) == run_chunk.EXIT_DONE
    evs = events(out.getvalue())
    progress = [e["framesDone"] for e in evs if e["event"] == "progress"]
    assert progress == sorted(progress) and progress[-1] == 12
    assert evs[-1] == {"event": "done", "framesDone": 12, "framesWritten": 24, "outputPath": str(out_file)}
    assert out_file.stat().st_size > 0


@needs_ffmpeg
def test_stop_request_cancels_and_removes_partial_output(clip, tmp_path):
    out_file = tmp_path / "chunk.mp4"
    out = io.StringIO()
    run_chunk.stop_requested.set()  # what the SIGTERM handler does
    assert run_chunk.main(io.StringIO(json.dumps(task(clip, out_file))), out) == run_chunk.EXIT_CANCELLED
    assert events(out.getvalue())[-1] == {"event": "cancelled"}
    assert not out_file.exists()


@needs_ffmpeg
def test_runs_as_a_child_process_like_the_worker_does(clip, tmp_path):
    """Exactly how the Java worker calls it: `python -m app.run_chunk`, task on stdin, JSON lines on stdout."""
    out_file = tmp_path / "chunk.mp4"
    proc = subprocess.run([sys.executable, "-m", "app.run_chunk"], cwd=ENGINE_DIR,
                          input=json.dumps(task(clip, out_file, frameCount=24, last=True)), capture_output=True, text=True,
                          timeout=120)
    assert proc.returncode == 0, proc.stderr
    evs = events(proc.stdout)  # every stdout line must be JSON
    assert evs[-1]["event"] == "done" and evs[-1]["framesWritten"] == (24 - 1) * 2 + 1
