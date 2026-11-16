"""Frame interpolators: given frames A and B, produce the (factor - 1) frames in between.

This module is the interface the pipeline uses. The math lives in app/engine/ and is all hand-written
NumPy (no OpenCV, no learned models):

    1. grayscale + Gaussian pyramid of both frames           engine/image.py, engine/pyramid.py
    2. scene-cut check on a small copy                        engine/image.py
    3. block matching + coarse-to-fine Lucas-Kanade flow      engine/flow.py
       A→B and B→A (solved on a copy whose longest side is <= max_side)
    4. occlusion masks from forward-backward consistency      engine/occlusion.py
    5. for each t: project the flow to time t (splatting)     engine/project.py
    6. upscale to full resolution                             engine/warp.py
    7. warp both frames to t and blend, occlusion-aware       engine/interpolate.py

Flow is computed ONCE per direction per pair; every in-between frame reuses it.
"""
from __future__ import annotations

from typing import Protocol

import numpy as np

from app.engine.flow import PRESETS, estimate_flow
from app.engine.image import mean_abs_diff, to_gray, to_uint8
from app.engine.interpolate import planes, synthesize
from app.engine.occlusion import occlusion_mask
from app.engine.project import global_motion, photometric_error, project_flow, splat_key
from app.engine.pyramid import build_pyramid
from app.engine.warp import upscale, upscale_flow


class Interpolator(Protocol):
    def between(self, a: np.ndarray, b: np.ndarray, factor: int) -> list[np.ndarray]:
        ...


def _timesteps(factor: int) -> list[float]:
    return [step / factor for step in range(1, factor)]


class BlendInterpolator:
    """Plain cross-fade. Fastest, but moving objects ghost. Kept as the 'blend' mode."""

    def between(self, a: np.ndarray, b: np.ndarray, factor: int) -> list[np.ndarray]:
        fa, fb = a.astype(np.float32), b.astype(np.float32)
        return [to_uint8(fa * (1.0 - t) + fb * t) for t in _timesteps(factor)]


class FlowInterpolator:
    """Bidirectional optical-flow interpolation. Not thread-safe: use one instance per worker thread."""

    def __init__(self, max_side: int = 640, preset: str = "medium", scene_cut_threshold: float = 40.0) -> None:
        self.max_side = max_side
        self.scene_cut_threshold = scene_cut_threshold
        self.settings = PRESETS.get(preset, PRESETS["medium"])
        # Frame B of one pair is frame A of the next: keep its pyramid instead of rebuilding it.
        self._cached_frame: np.ndarray | None = None
        self._cached_pyramid: list[np.ndarray] | None = None

    def between(self, a: np.ndarray, b: np.ndarray, factor: int) -> list[np.ndarray]:
        h, w = a.shape[:2]
        pyr_a, pyr_b = self._pyramid(a), self._pyramid(b)
        level = self._flow_level(pyr_a)

        # Scene cut: no motion connects these frames, so warping would invent garbage.
        # Repeat the nearest real frame instead.
        if mean_abs_diff(pyr_a[level], pyr_b[level]) > self.scene_cut_threshold:
            return [a if t < 0.5 else b for t in _timesteps(factor)]

        small_a, small_b = pyr_a[level], pyr_b[level]
        f01 = estimate_flow(pyr_a, pyr_b, self.settings, level)
        f10 = estimate_flow(pyr_b, pyr_a, self.settings, level)
        occ_a = occlusion_mask(f01, f10)
        occ_b = occlusion_mask(f10, f01)

        # Everything that doesn't depend on t is computed once per pair, at flow resolution.
        background = global_motion(f01)
        key_a = splat_key(photometric_error(small_a, small_b, f01), occ_a, f01, background)
        key_b = splat_key(photometric_error(small_b, small_a, f10), occ_b, -f10, background)

        scale = 2 ** level
        occ_a_full = upscale(occ_a, h, w, scale)
        occ_b_full = upscale(occ_b, h, w, scale)

        planes_a, planes_b = planes(a), planes(b)
        frames = []
        for t in _timesteps(factor):
            u_t = upscale_flow(project_flow(f01, f10, key_a, key_b, background, t), h, w, scale)
            ft0 = u_t * np.float32(-t)
            ft1 = u_t * np.float32(1.0 - t)
            frames.append(synthesize(planes_a, planes_b, ft0, ft1, occ_a_full, occ_b_full, t))
        return frames

    def _pyramid(self, frame: np.ndarray) -> list[np.ndarray]:
        if frame is self._cached_frame and self._cached_pyramid is not None:
            return self._cached_pyramid
        pyramid = build_pyramid(to_gray(frame))
        self._cached_frame, self._cached_pyramid = frame, pyramid
        return pyramid

    def _flow_level(self, pyramid: list[np.ndarray]) -> int:
        """Finest pyramid level whose longest side fits in max_side (flow is upscaled from there)."""
        for level, img in enumerate(pyramid):
            if max(img.shape) <= self.max_side:
                return level
        return len(pyramid) - 1


def create_interpolator(mode: str, max_side: int, preset: str, scene_cut_threshold: float) -> Interpolator:
    if mode == "blend":
        return BlendInterpolator()
    return FlowInterpolator(max_side=max_side, preset=preset, scene_cut_threshold=scene_cut_threshold)
