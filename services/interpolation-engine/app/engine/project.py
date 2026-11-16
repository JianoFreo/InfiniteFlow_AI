"""Flow projection: where is every pixel at time t, and how is it moving? (Baker et al., 2011)

Reading F_0→1 at the in-between pixel's own position (the Super SloMo "linear" shortcut) breaks when
a small object moves further than its own width: at that position F_0→1 and F_1→0 describe
DIFFERENT things (the object in one frame, background in the other). Super SloMo fixes that with a
learned network. We fix it geometrically instead, by forward-splatting the flow:

    every pixel x of frame 0 lands at  x + t·F_0→1(x)       carrying motion  u = F_0→1(x)
    every pixel y of frame 1 lands at  y + (1-t)·F_1→0(y)   carrying motion  u = -F_1→0(y)

which gives u_t, the 0→1 motion of whatever sits at each pixel at time t. Then:

    F_t→0 = -t·u_t        F_t→1 = (1-t)·u_t

Collisions (two sources landing on one pixel) are resolved z-buffer style, lowest key wins:

    key = photometric error of the source  +  penalty · occluded(source)  -  κ · |u - global motion|

  - a source whose flow doesn't match (high error, or occluded in the other frame) loses;
  - between equally good sources, the one moving AGAINST the camera/global motion is treated as the
    foreground object in front. That's right for a static camera (the moving thing is in front) and
    for a panning one (the tracked subject is in front).

Pixels nothing lands on (holes) are filled from their neighbours.
"""
from __future__ import annotations

import numpy as np

from app.engine.pyramid import box_filter
from app.engine.warp import Sampler, identity_grid

OCCLUSION_PENALTY = 50.0  # intensity units: an occluded source almost always loses
FOREGROUND_BONUS = 0.25   # κ, intensity units per pixel of motion away from the global motion
_FILL_ITERATIONS = 64


def photometric_error(i0: np.ndarray, i1: np.ndarray, f01: np.ndarray) -> np.ndarray:
    """|I1(x + F01(x)) - I0(x)| averaged over a 3x3 window: how well each pixel's flow fits."""
    h, w = i0.shape
    xs, ys = identity_grid(h, w)
    warped = Sampler(xs + f01[..., 0], ys + f01[..., 1], h, w)(i1)
    return box_filter(np.abs(warped - i0), 1)


def global_motion(f01: np.ndarray) -> np.ndarray:
    """Dominant (camera) motion: per-component median of the flow field."""
    return np.median(f01.reshape(-1, 2), axis=0).astype(np.float32)


def splat_key(error: np.ndarray, occluded: np.ndarray, motion: np.ndarray, background: np.ndarray) -> np.ndarray:
    deviation = np.hypot(motion[..., 0] - background[0], motion[..., 1] - background[1])
    return (error + OCCLUSION_PENALTY * occluded - FOREGROUND_BONUS * deviation).astype(np.float32)


def _splat(tx: np.ndarray, ty: np.ndarray, motion: np.ndarray, key: np.ndarray, h: int, w: int):
    """Each source lands on the pixel nearest its sub-pixel target (the small gaps this leaves are
    filled afterwards). Returns flat targets, motions and keys of the sources that stay in frame."""
    cx = np.rint(tx).astype(np.intp)
    cy = np.rint(ty).astype(np.intp)
    inside = (cx >= 0) & (cx < w) & (cy >= 0) & (cy < h)
    return (cy * w + cx)[inside], motion[inside], key[inside]


def fill_holes(field: np.ndarray, filled: np.ndarray, fallback: np.ndarray) -> np.ndarray:
    """Grow the known values into the holes, one ring of pixels per iteration (normalised 3x3 average)."""
    field = field.copy()
    filled = filled.copy()
    field[~filled] = 0.0
    for _ in range(_FILL_ITERATIONS):
        if filled.all():
            break
        mask = filled.astype(np.float32)
        weight = box_filter(mask, 1)
        total = box_filter(field * mask[..., None], 1)
        grow = (~filled) & (weight > 0)
        field[grow] = total[grow] / weight[grow][..., None]
        filled |= grow
    field[~filled] = fallback
    return field


def project_flow(f01: np.ndarray, f10: np.ndarray, key0: np.ndarray, key1: np.ndarray,
                 background: np.ndarray, t: float) -> np.ndarray:
    """u_t: the frame-0 → frame-1 motion of the content at each pixel at time t. (H, W, 2) float32.

    key0 / key1 are the splat keys of frame 0's and frame 1's pixels (see splat_key), computed once
    per frame pair because they don't depend on t.
    """
    h, w = f01.shape[:2]
    xs, ys = identity_grid(h, w)

    t0, m0, k0 = _splat(xs + t * f01[..., 0], ys + t * f01[..., 1], f01, key0, h, w)
    t1, m1, k1 = _splat(xs + (1.0 - t) * f10[..., 0], ys + (1.0 - t) * f10[..., 1], -f10, key1, h, w)
    targets = np.concatenate([t0, t1])
    motions = np.concatenate([m0, m1])
    keys = np.concatenate([k0, k1])

    # Z-buffer: smallest key per target pixel wins.
    best = np.full(h * w, np.inf, dtype=np.float32)
    np.minimum.at(best, targets, keys)
    winners = keys == best[targets]

    flat = np.zeros((h * w, 2), dtype=np.float32)
    flat[targets[winners]] = motions[winners]
    filled = np.zeros(h * w, dtype=bool)
    filled[targets[winners]] = True
    return fill_holes(flat.reshape(h, w, 2), filled.reshape(h, w), background)
