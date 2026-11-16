"""Occlusion detection by forward-backward consistency (Sundaram, Brox & Keutzer, 2010).

If pixel x in A really moves to y = x + F_a→b(x) in B, then B's flow at y should point straight back:
F_b→a(y) ≈ -F_a→b(x). When it doesn't, x is covered up (occluded) in B, or the flow there is wrong;
either way B can't be trusted for that pixel.

    occluded  ⇔  |F_ab(x) + F_ba(y)|² > α·(|F_ab(x)|² + |F_ba(y)|²) + β

Pixels whose match lands outside the frame are occluded too (they leave the picture).
"""
from __future__ import annotations

import numpy as np

from app.engine.pyramid import gaussian_blur
from app.engine.warp import Sampler, identity_grid

ALPHA = 0.01
BETA = 0.5


def occlusion_mask(f_ab: np.ndarray, f_ba: np.ndarray, soften_sigma: float = 1.0) -> np.ndarray:
    """Soft mask over A's pixels: 1.0 = not visible in B, 0.0 = visible. float32 (H, W)."""
    h, w = f_ab.shape[:2]
    xs, ys = identity_grid(h, w)
    tx = xs + f_ab[..., 0]
    ty = ys + f_ab[..., 1]
    back = Sampler(tx, ty, h, w)(f_ba)

    err = np.sum((f_ab + back) ** 2, axis=2)
    tolerance = ALPHA * (np.sum(f_ab ** 2, axis=2) + np.sum(back ** 2, axis=2)) + BETA
    outside = (tx < 0) | (tx > w - 1) | (ty < 0) | (ty > h - 1)
    mask = ((err > tolerance) | outside).astype(np.float32)
    # Soft edges blend better than a hard cut-out.
    return np.clip(gaussian_blur(mask, soften_sigma), 0.0, 1.0)
