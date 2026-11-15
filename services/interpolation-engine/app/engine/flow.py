"""Dense optical flow: block-matching start + coarse-to-fine, robust, iterative Lucas-Kanade.

Brightness constancy says a pixel keeps its value as it moves:  I1(x + u) = I0(x).
Linearising around the current estimate u gives, for the correction du:

    Ix·du_x + Iy·du_y + It = 0          (It = I1(x + u) - I0(x))

One equation, two unknowns, so Lucas-Kanade assumes du is constant in a small window W around x
and solves the weighted least-squares system

    | Σw·Ix·Ix + λ   Σw·Ix·Iy     | |du_x|     | -Σw·Ix·It |
    | Σw·Ix·Iy       Σw·Iy·Iy + λ | |du_y|  =  | -Σw·Iy·It |

for EVERY pixel at once (each Σ is a box filter over W).
  - λ is a small Tikhonov term: in flat areas, where the system is singular, it makes du ≈ 0, so the
    flow inherited from the coarser level survives.
  - w = 1 / sqrt(1 + (It/σ)²) is a Charbonnier (robust) weight: pixels that don't fit the current
    motion at all, typically the far side of a motion boundary, get little say in the solution.

Three extra steps make it work on real footage, not just textbook images:
  1. Block matching at the coarsest level. Lucas-Kanade only sees motion of about a pixel or two, so
     the pyramid starts from an exhaustive integer search. That costs almost nothing on a tiny image
     and extends the capture range to search_radius · 2^levels pixels at full size.
  2. Candidate selection. After upsampling and after each refinement, every pixel keeps whichever
     candidate flow (new, previous, or zero) has the lowest patch matching cost. A static background
     next to a fast object can't inherit the object's motion this way.
  3. Propagation (as in PatchMatch): each pixel also tries its neighbours' flow vectors, so good
     estimates spread into regions where the local solve went wrong (frame borders, motion edges).
  4. A 3x3 median after each level removes isolated outliers, and a light Gaussian smooths the field.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.engine.image import gradients
from app.engine.pyramid import box_filter, gaussian_blur
from app.engine.warp import Sampler, identity_grid, upscale_flow


@dataclass(frozen=True)
class FlowSettings:
    iterations: int = 4          # warp/solve rounds per pyramid level
    window_radius: int = 3       # LK window is (2r+1)^2 pixels
    regularization: float = 1.0  # λ, in (intensity units)^2
    robust_sigma: float = 10.0   # σ of the Charbonnier weight, in intensity units (0 = plain LK)
    max_step: float = 2.0        # largest correction per iteration (px); linearisation breaks beyond that
    search_radius: int = 4       # block-matching search at the coarsest level: ±r px there
    motion_penalty: float = 0.05 # tie-breaker in block matching: prefer smaller motion when costs are equal
    median: bool = True          # 3x3 median after each level
    smooth_sigma: float = 0.8    # Gaussian smoothing of the flow after each level (0 = off)
    propagation: tuple[int, ...] = (8, 4, 2)  # PatchMatch-style neighbour distances per level (() = off)


# Same preset names the engine has always accepted through FLOW_PRESET.
PRESETS: dict[str, FlowSettings] = {
    "ultrafast": FlowSettings(iterations=1, median=False, search_radius=3, propagation=()),
    "fast": FlowSettings(iterations=2, propagation=(4,)),
    "medium": FlowSettings(iterations=4),
}


# ---- helpers ------------------------------------------------------------------------------

# Median of 9 with 19 compare-exchanges (the classic network from Paeth, Graphics Gems, 1990).
# After these swaps, element 4 holds the median. Each swap is a whole-array min/max, so the
# median of every 3x3 neighbourhood in the image is found at once with no sorting.
_MEDIAN9_NETWORK = (
    (1, 2), (4, 5), (7, 8), (0, 1), (3, 4), (6, 7), (1, 2), (4, 5), (7, 8), (0, 3),
    (5, 8), (4, 7), (3, 6), (1, 4), (2, 5), (4, 7), (4, 2), (6, 4), (4, 2),
)


def median3(field: np.ndarray) -> np.ndarray:
    """3x3 median of each channel of an (H, W, C) field, edges replicated."""
    h, w = field.shape[:2]
    p = np.pad(field, ((1, 1), (1, 1), (0, 0)), mode="edge")
    v = [p[dy:dy + h, dx:dx + w] for dy in range(3) for dx in range(3)]
    for i, j in _MEDIAN9_NETWORK:
        v[i], v[j] = np.minimum(v[i], v[j]), np.maximum(v[i], v[j])
    return np.ascontiguousarray(v[4], dtype=np.float32)


def shift_image(img: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """out(x, y) = img(x + dx, y + dy) for integer shifts, edges replicated."""
    h, w = img.shape[:2]
    rows = np.clip(np.arange(h) + dy, 0, h - 1)
    cols = np.clip(np.arange(w) + dx, 0, w - 1)
    return img[rows[:, None], cols[None, :]]


def patch_cost(i0: np.ndarray, i1: np.ndarray, flow: np.ndarray, window_radius: int) -> np.ndarray:
    """Mean absolute difference between I0's patch at x and I1's patch at x + flow(x)."""
    h, w = i0.shape
    xs, ys = identity_grid(h, w)
    warped = Sampler(xs + flow[..., 0], ys + flow[..., 1], h, w)(i1)
    return box_filter(np.abs(warped - i0), window_radius)


def pick_best(i0: np.ndarray, i1: np.ndarray, window_radius: int, best: np.ndarray,
              best_cost: np.ndarray | None, *candidates: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per pixel, keep `best` unless a candidate has a strictly lower patch cost.
    Returns (flow, cost); pass the cost back in next time so it isn't recomputed."""
    flow = best.copy()
    cost = patch_cost(i0, i1, best, window_radius) if best_cost is None else best_cost.copy()
    for candidate in candidates:
        c = patch_cost(i0, i1, candidate, window_radius)
        better = c < cost
        cost[better] = c[better]
        flow[better] = candidate[better]
    return flow, cost


def propagate(i0: np.ndarray, i1: np.ndarray, flow: np.ndarray, cost: np.ndarray | None,
              window_radius: int, distances: tuple[int, ...]) -> np.ndarray:
    """PatchMatch-style propagation: every pixel also tries the flow of the pixels `d` away to the
    left, right, above and below, and keeps whichever matches best. Good flow spreads into areas
    where the estimate went wrong (borders, motion boundaries, textureless patches)."""
    for d in distances:
        neighbours = [shift_image(flow, dx, dy) for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d))]
        flow, cost = pick_best(i0, i1, window_radius, flow, cost, *neighbours)
    return flow


def block_match(i0: np.ndarray, i1: np.ndarray, radius: int, window_radius: int,
                motion_penalty: float) -> np.ndarray:
    """Exhaustive integer search: for every pixel, the shift in [-r, r]^2 with the lowest patch cost."""
    h, w = i0.shape
    best_cost = np.full((h, w), np.inf, dtype=np.float32)
    best = np.zeros((h, w, 2), dtype=np.float32)
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            cost = box_filter(np.abs(shift_image(i1, dx, dy) - i0), window_radius)
            cost += motion_penalty * float(np.hypot(dx, dy))
            better = cost < best_cost
            best_cost[better] = cost[better]
            best[better] = (dx, dy)
    return best


# ---- Lucas-Kanade -------------------------------------------------------------------------

def lucas_kanade_level(i0: np.ndarray, i1: np.ndarray, flow: np.ndarray, s: FlowSettings) -> np.ndarray:
    """Refine `flow` (I0 → I1) at one pyramid level. Returns a new array."""
    h, w = i0.shape
    xs, ys = identity_grid(h, w)
    gx0, gy0 = gradients(i0)
    gx1, gy1 = gradients(i1)
    lam = np.float32(s.regularization)
    r = s.window_radius
    flow = flow.copy()

    for _ in range(s.iterations):
        tx, ty = xs + flow[..., 0], ys + flow[..., 1]
        sample = Sampler(tx, ty, h, w)
        it = sample(i1) - i0
        # Matches that land outside the frame read replicated edge pixels: they carry no information.
        inside = ((tx >= 0) & (tx <= w - 1) & (ty >= 0) & (ty <= h - 1)).astype(np.float32)
        # Averaging both frames' gradients (the second one warped into place) is more accurate
        # than using I0's alone when the motion isn't tiny.
        ix = 0.5 * (gx0 + sample(gx1))
        iy = 0.5 * (gy0 + sample(gy1))
        if s.robust_sigma > 0:
            wgt = 1.0 / np.sqrt(1.0 + (it / np.float32(s.robust_sigma)) ** 2)
        else:
            wgt = np.ones_like(it)
        wgt *= inside
        wix, wiy = wgt * ix, wgt * iy

        sxx = box_filter(wix * ix, r) + lam
        syy = box_filter(wiy * iy, r) + lam
        sxy = box_filter(wix * iy, r)
        bx = -box_filter(wix * it, r)
        by = -box_filter(wiy * it, r)

        det = sxx * syy - sxy * sxy  # > 0: λ > 0 makes the matrix positive definite
        du = (syy * bx - sxy * by) / det
        dv = (sxx * by - sxy * bx) / det

        step = np.hypot(du, dv)
        limit = np.minimum(1.0, s.max_step / np.maximum(step, 1e-6)).astype(np.float32)
        flow[..., 0] += du * limit
        flow[..., 1] += dv * limit
    return flow


def estimate_flow(pyr0: list[np.ndarray], pyr1: list[np.ndarray], settings: FlowSettings,
                  finest_level: int = 0) -> np.ndarray:
    """Flow I0 → I1 at pyramid level `finest_level`, solved coarse-to-fine from the top of the pyramid.

    Stopping at a finest_level > 0 is how the engine keeps cost down on big frames: motion is
    estimated on a small copy and upscaled afterwards (see warp.upscale_flow).
    """
    if len(pyr0) != len(pyr1):
        raise ValueError("pyramids must have the same number of levels")
    s = settings
    coarsest = len(pyr0) - 1
    flow: np.ndarray | None = None

    for level in range(coarsest, finest_level - 1, -1):
        i0, i1 = pyr0[level], pyr1[level]
        h, w = i0.shape
        zero = np.zeros((h, w, 2), dtype=np.float32)

        if flow is None:
            start = block_match(i0, i1, s.search_radius, s.window_radius, s.motion_penalty)
            start_cost = None
        else:
            start, start_cost = pick_best(i0, i1, s.window_radius, upscale_flow(flow, h, w, 2), None, zero)

        refined = lucas_kanade_level(i0, i1, start, s)
        if s.median:
            refined = median3(refined)
        if s.smooth_sigma > 0:
            refined = gaussian_blur(refined, s.smooth_sigma)
        # Refinement can drift where there is no texture or across motion boundaries: keep what matches.
        flow, cost = pick_best(i0, i1, s.window_radius, start, start_cost, refined)
        # Propagation on the coarse levels only: that's where a bad estimate spreads widest, and the
        # images are small there. At the finest level Lucas-Kanade's own correction is enough.
        if s.propagation and level > finest_level:
            flow = propagate(i0, i1, flow, cost, s.window_radius, s.propagation)
    return flow
