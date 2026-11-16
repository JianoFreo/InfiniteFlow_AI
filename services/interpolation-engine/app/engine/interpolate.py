"""Building the in-between frame at time t (0 < t < 1), given the flows from that frame back to
each real frame (from project.py: F_t→0 = -t·u_t, F_t→1 = (1-t)·u_t).

Both frames are pulled to time t and blended, weighting each by how close it is in time and
whether the content is visible in it:

    w0 = (1-t)·(1 - H0)          H0: "this pixel's content is hidden in frame 0"
    w1 =   t  ·(1 - H1)          H1: "this pixel's content is hidden in frame 1"
    I_t = (w0·warp(I_0, F_t→0) + w1·warp(I_1, F_t→1)) / (w0 + w1)

H1 comes from frame 0's occlusion mask (frame-0 pixels covered in frame 1) sampled along F_t→0,
and H0 from frame 1's mask sampled along F_t→1. Content hidden in one frame must come from the
other, so the hidden frame's weight drops.

Moving objects are drawn once, at their in-between position, instead of the two faint copies a
plain cross-fade gives.

Frames are handled as separate colour planes (see `planes`): NumPy runs much faster on one long
contiguous plane than on an (H, W, 3) array whose innermost axis has only 3 elements.
"""
from __future__ import annotations

import numpy as np

from app.engine.warp import Sampler, identity_grid

# Keeps the division safe and falls back to a plain time-weighted blend where both masks say "hidden".
_EPS = 1e-3


def planes(frame: np.ndarray) -> list[np.ndarray]:
    """(H, W, C) → C contiguous (H, W) planes. Done once per frame, reused for every t."""
    return [np.ascontiguousarray(frame[..., c]) for c in range(frame.shape[2])]


def synthesize(planes0: list[np.ndarray], planes1: list[np.ndarray], ft0: np.ndarray, ft1: np.ndarray,
               occ0: np.ndarray, occ1: np.ndarray, t: float) -> np.ndarray:
    """All inputs at full resolution: colour planes of each frame, flows (H, W, 2), masks (H, W).
    Returns the in-between frame as uint8 (H, W, C), ready for the encoder."""
    h, w = planes0[0].shape
    xs, ys = identity_grid(h, w)

    from0 = Sampler(xs + ft0[..., 0], ys + ft0[..., 1], h, w)
    from1 = Sampler(xs + ft1[..., 0], ys + ft1[..., 1], h, w)
    hidden_in_1 = from0(occ0)  # the frame-0 source of this pixel is covered in frame 1
    hidden_in_0 = from1(occ1)  # the frame-1 source of this pixel is covered in frame 0

    w0 = (1.0 - t) * (1.0 - hidden_in_0 + _EPS)
    w1 = t * (1.0 - hidden_in_1 + _EPS)
    total = w0 + w1
    w0 /= total
    w1 /= total

    out = np.empty((h, w, len(planes0)), dtype=np.uint8)
    for c, (p0, p1) in enumerate(zip(planes0, planes1)):
        value = from0(p0) * w0
        value += from1(p1) * w1
        np.rint(value, out=value)
        np.clip(value, 0, 255, out=value)
        out[..., c] = value
    return out
