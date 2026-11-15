"""Frame interpolators: given frames A and B, produce the (factor - 1) frames in between.

FlowInterpolator is the default. For each pair it computes optical flow ONCE in each direction
(A→B and B→A) with OpenCV's DIS algorithm, then builds every in-between frame from those two flows.
The old worker recomputed Farneback flow for every in-between frame, so at 8x it did 7x the work.

Approximating the flow from the unknown middle frame back to A and B (the "linear" approximation
from the Super SloMo paper, Jiang et al. 2018):

    F_t→0 = -(1-t)·t·F_0→1 + t²·F_1→0
    F_t→1 = (1-t)²·F_0→1 - t·(1-t)·F_1→0
    I_t   = (1-t)·warp(I_0, F_t→0) + t·warp(I_1, F_t→1)

Warping both frames toward time t and blending them means an object is drawn once, at its
in-between position, instead of the two half-transparent copies a plain cross-fade gives.
"""
from __future__ import annotations

from typing import Protocol

import cv2
import numpy as np

_DIS_PRESETS = {
    "ultrafast": cv2.DISOPTICAL_FLOW_PRESET_ULTRAFAST,
    "fast": cv2.DISOPTICAL_FLOW_PRESET_FAST,
    "medium": cv2.DISOPTICAL_FLOW_PRESET_MEDIUM,
}


class Interpolator(Protocol):
    def between(self, a: np.ndarray, b: np.ndarray, factor: int) -> list[np.ndarray]:
        ...


def _timesteps(factor: int) -> list[float]:
    return [step / factor for step in range(1, factor)]


class BlendInterpolator:
    """Plain cross-fade. Fastest, but moving objects ghost. Kept as the 'blend' mode."""

    def between(self, a: np.ndarray, b: np.ndarray, factor: int) -> list[np.ndarray]:
        return [cv2.addWeighted(a, 1.0 - t, b, t, 0.0) for t in _timesteps(factor)]


class FlowInterpolator:
    """Bidirectional optical-flow interpolation. One instance per thread (DIS objects are not thread-safe)."""

    def __init__(self, max_side: int = 640, preset: str = "medium", scene_cut_threshold: float = 40.0) -> None:
        self.max_side = max_side
        self.scene_cut_threshold = scene_cut_threshold
        self._dis = cv2.DISOpticalFlow_create(_DIS_PRESETS.get(preset, cv2.DISOPTICAL_FLOW_PRESET_MEDIUM))
        self._grid: np.ndarray | None = None
        self._grid_shape: tuple[int, int] | None = None

    def between(self, a: np.ndarray, b: np.ndarray, factor: int) -> list[np.ndarray]:
        h, w = a.shape[:2]
        small_a, small_b = self._small_gray(a), self._small_gray(b)

        # Scene cut: no motion connects these frames, so warping would invent garbage.
        # Repeat the nearest real frame instead.
        if float(cv2.absdiff(small_a, small_b).mean()) > self.scene_cut_threshold:
            return [a if t < 0.5 else b for t in _timesteps(factor)]

        f01 = self._full_res_flow(self._dis.calc(small_a, small_b, None), w, h)
        f10 = self._full_res_flow(self._dis.calc(small_b, small_a, None), w, h)
        grid = self._identity_grid(h, w)

        frames = []
        for t in _timesteps(factor):
            ft0 = cv2.addWeighted(f01, -(1.0 - t) * t, f10, t * t, 0.0)
            ft1 = cv2.addWeighted(f01, (1.0 - t) * (1.0 - t), f10, -t * (1.0 - t), 0.0)
            # remap(src, map) samples src at map(x): map = x + F_t→0(x) pulls pixels of A to time t.
            warped_a = cv2.remap(a, cv2.add(grid, ft0), None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            warped_b = cv2.remap(b, cv2.add(grid, ft1), None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            frames.append(cv2.addWeighted(warped_a, 1.0 - t, warped_b, t, 0.0))
        return frames

    def _small_gray(self, frame: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        scale = self.max_side / max(h, w)
        if scale >= 1.0:
            return gray
        return cv2.resize(gray, (max(8, round(w * scale)), max(8, round(h * scale))), interpolation=cv2.INTER_AREA)

    @staticmethod
    def _full_res_flow(flow: np.ndarray, w: int, h: int) -> np.ndarray:
        fh, fw = flow.shape[:2]
        if (fw, fh) == (w, h):
            return flow
        # Upsample the field, then scale the vectors: 3 px of motion at 640 px is 9 px at 1920 px.
        full = cv2.resize(flow, (w, h), interpolation=cv2.INTER_LINEAR)
        full *= np.array([w / fw, h / fh], dtype=np.float32)
        return full

    def _identity_grid(self, h: int, w: int) -> np.ndarray:
        if self._grid_shape != (h, w):
            xs, ys = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
            self._grid = np.dstack((xs, ys))
            self._grid_shape = (h, w)
        return self._grid


def create_interpolator(mode: str, max_side: int, preset: str, scene_cut_threshold: float) -> Interpolator:
    if mode == "blend":
        return BlendInterpolator()
    return FlowInterpolator(max_side=max_side, preset=preset, scene_cut_threshold=scene_cut_threshold)
