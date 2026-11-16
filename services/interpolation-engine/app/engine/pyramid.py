"""Filters and the Gaussian image pyramid.

The pyramid lets optical flow handle large motion: 32 px of motion at full size is 2 px four levels
down, where Lucas-Kanade's small-motion assumption holds. Flow is solved at the coarsest level first,
then refined level by level (coarse-to-fine).

Level k has size ceil(size / 2^k), and pixel x at level k sits at pixel x * 2^k at level 0.
"""
from __future__ import annotations

import numpy as np

# 5-tap binomial kernel ≈ Gaussian with sigma 1: the classic Burt & Adelson pyramid filter.
_BINOMIAL_5 = np.array([1, 4, 6, 4, 1], dtype=np.float32) / 16.0


def gaussian_kernel(sigma: float) -> np.ndarray:
    radius = max(1, int(np.ceil(3.0 * sigma)))
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    k = np.exp(-(x * x) / (2.0 * sigma * sigma))
    return (k / k.sum()).astype(np.float32)


def _convolve_axis(img: np.ndarray, kernel: np.ndarray, axis: int) -> np.ndarray:
    """1-D convolution along one axis with replicated edges, as a sum of shifted copies."""
    r = len(kernel) // 2
    n = img.shape[axis]
    pad = [(0, 0)] * img.ndim
    pad[axis] = (r, r)
    padded = np.pad(img, pad, mode="edge")
    out = np.zeros(img.shape, dtype=np.float32)
    index = [slice(None)] * img.ndim
    for i, weight in enumerate(kernel):
        index[axis] = slice(i, i + n)
        out += weight * padded[tuple(index)]
    return out


def convolve_separable(img: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    """Same 1-D kernel along rows then columns. Works on (H, W) and (H, W, C)."""
    return _convolve_axis(_convolve_axis(img, kernel, 0), kernel, 1)


def gaussian_blur(img: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0:
        return img
    return convolve_separable(img, gaussian_kernel(sigma))


_DIRECT_BOX_MAX_RADIUS = 4


def _box_axis(img: np.ndarray, radius: int, axis: int) -> np.ndarray:
    """Running mean over 2r+1 samples along one axis, edges replicated.

    Small windows: add up the 2r+1 shifted copies (fast, exact enough in float32).
    Large windows: cumulative sum, O(1) per pixel whatever the radius, accumulated in float64
    because long running sums of squared gradients lose precision in float32.
    """
    n = img.shape[axis]
    if radius <= _DIRECT_BOX_MAX_RADIUS:
        pad = [(0, 0)] * img.ndim
        pad[axis] = (radius, radius)
        padded = np.pad(img.astype(np.float32, copy=False), pad, mode="edge")
        index = [slice(None)] * img.ndim
        index[axis] = slice(0, n)
        out = padded[tuple(index)].copy()
        for i in range(1, 2 * radius + 1):
            index[axis] = slice(i, i + n)
            out += padded[tuple(index)]
        out *= np.float32(1.0 / (2 * radius + 1))
        return out
    pad = [(0, 0)] * img.ndim
    pad[axis] = (radius + 1, radius)
    c = np.cumsum(np.pad(img, pad, mode="edge"), axis=axis, dtype=np.float64)
    hi = [slice(None)] * img.ndim
    lo = [slice(None)] * img.ndim
    hi[axis] = slice(2 * radius + 1, 2 * radius + 1 + n)
    lo[axis] = slice(0, n)
    return ((c[tuple(hi)] - c[tuple(lo)]) / (2 * radius + 1)).astype(np.float32)


def box_filter(img: np.ndarray, radius: int) -> np.ndarray:
    """Mean over a (2r+1) x (2r+1) window. Used as the Lucas-Kanade integration window."""
    return _box_axis(_box_axis(img, radius, 0), radius, 1)


def downsample(img: np.ndarray) -> np.ndarray:
    """Blur (anti-alias) then keep every second pixel."""
    return convolve_separable(img, _BINOMIAL_5)[::2, ::2]


def build_pyramid(img: np.ndarray, min_side: int = 12, max_levels: int = 12) -> list[np.ndarray]:
    """[level 0 (full size), level 1 (half), ...] until the next level would be smaller than min_side."""
    levels = [img.astype(np.float32, copy=False)]
    while len(levels) < max_levels:
        h, w = levels[-1].shape[:2]
        if min((h + 1) // 2, (w + 1) // 2) < min_side:
            break
        levels.append(downsample(levels[-1]))
    return levels
