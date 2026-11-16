"""Basic per-pixel image operations."""
from __future__ import annotations

import numpy as np

# ITU-R BT.601 luma weights, in B, G, R order because ffmpeg hands us bgr24 frames.
_BGR_TO_GRAY = np.array([0.114, 0.587, 0.299], dtype=np.float32)


def to_gray(frame: np.ndarray) -> np.ndarray:
    """uint8 BGR (H, W, 3) → float32 luminance (H, W) in 0..255."""
    if frame.ndim == 2:
        return frame.astype(np.float32)
    return frame.astype(np.float32) @ _BGR_TO_GRAY


def gradients(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Central differences dI/dx and dI/dy, edges replicated. Returns float32 (H, W) each."""
    p = np.pad(img, 1, mode="edge")
    gx = (p[1:-1, 2:] - p[1:-1, :-2]) * 0.5
    gy = (p[2:, 1:-1] - p[:-2, 1:-1]) * 0.5
    return gx.astype(np.float32, copy=False), gy.astype(np.float32, copy=False)


def to_uint8(img: np.ndarray) -> np.ndarray:
    """Round and clamp a float image to a contiguous uint8 image (what the encoder expects)."""
    return np.ascontiguousarray(np.clip(np.rint(img), 0, 255).astype(np.uint8))


def mean_abs_diff(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.abs(a - b).mean())
