"""Chunk math: processing in parallel chunks must give exactly the same frames as processing in one go."""
import numpy as np
import pytest

from app.pipeline import Cancelled, ChunkTask, interpolate_frames


class LabelInterpolator:
    """Fake interpolator: frames are 1x1 arrays holding a float label, in-betweens are labelled a + t."""

    def between(self, a, b, factor):
        return [np.array([[a[0, 0] + (b[0, 0] - a[0, 0]) * k / factor]]) for k in range(1, factor)]


def source(n):
    return [np.array([[float(i)]]) for i in range(n)]


def run_whole(n, factor):
    out = []
    interpolate_frames(source(n), n, factor, LabelInterpolator(), out.append)
    return [f[0, 0] for f in out]


def run_chunked(n, factor, chunk):
    """Mimics the engine: chunk i reads frames [start, start+len] (+1 look-ahead unless last)."""
    frames = source(n)
    starts = list(range(0, n, chunk))
    out = []
    for idx, start in enumerate(starts):
        last = idx == len(starts) - 1
        length = min(chunk, n - start)
        reader = frames[start:start + length + (0 if last else 1)]
        interpolate_frames(reader, length, factor, LabelInterpolator(), out.append)
    return [f[0, 0] for f in out]


@pytest.mark.parametrize("n", [2, 3, 59, 60, 61, 121, 300])
@pytest.mark.parametrize("factor", [2, 4, 8])
@pytest.mark.parametrize("chunk", [24, 60])
def test_chunked_equals_whole(n, factor, chunk):
    whole = run_whole(n, factor)
    assert len(whole) == (n - 1) * factor + 1
    assert run_chunked(n, factor, chunk) == whole


def test_output_is_evenly_spaced():
    assert run_whole(3, 4) == [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]


def test_estimate_overshoot_gives_empty_last_chunk():
    # job-service thought there were 70 frames, the decoder only delivered 60
    out = []
    done = interpolate_frames(source(60)[60:], 10, 2, LabelInterpolator(), out.append)
    assert done == 0 and out == []


def test_cancel_stops_between_frames():
    calls = {"n": 0}

    def should_stop():
        calls["n"] += 1
        return calls["n"] > 3

    with pytest.raises(Cancelled):
        interpolate_frames(source(50), 50, 2, LabelInterpolator(), lambda f: None, should_stop=should_stop)


def test_task_from_message_validates_factor():
    msg = {"jobId": 1, "chunkIndex": 0, "sourcePath": "/data/x.mp4", "startFrame": 0, "frameCount": 60,
           "last": True, "factor": 9, "mode": "flow", "fps": "30/1", "width": 64, "height": 64,
           "outputPath": "/data/jobs/1/chunk_00000.mp4"}
    with pytest.raises(ValueError):
        ChunkTask.from_message(msg)
    msg["factor"] = 4
    assert ChunkTask.from_message(msg).factor == 4
