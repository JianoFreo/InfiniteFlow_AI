"""Bilinear sampling: our own version of OpenCV's remap.

    out(x, y) = img(map_x(x, y), map_y(x, y))

Coordinates outside the image are clamped to the nearest edge pixel (BORDER_REPLICATE).
A Sampler computes the four neighbour indices and weights ONCE, so several images that share the
same map (a colour frame and its occlusion mask, say) are sampled for the price of one lookup.
"""
from __future__ import annotations

import numpy as np

_grid_cache: dict[tuple[int, int], tuple[np.ndarray, np.ndarray]] = {}


def identity_grid(h: int, w: int) -> tuple[np.ndarray, np.ndarray]:
    """(xs, ys): xs[y, x] = x and ys[y, x] = y, float32. Cached per size (read-only, don't mutate)."""
    key = (h, w)
    grid = _grid_cache.get(key)
    if grid is None:
        ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
        xs.flags.writeable = False
        ys.flags.writeable = False
        grid = (xs, ys)
        if len(_grid_cache) > 8:
            _grid_cache.clear()
        _grid_cache[key] = grid
    return grid


class Sampler:
    def __init__(self, map_x: np.ndarray, map_y: np.ndarray, src_h: int, src_w: int) -> None:
        x = np.clip(map_x, np.float32(0), np.float32(src_w - 1), dtype=np.float32)
        y = np.clip(map_y, np.float32(0), np.float32(src_h - 1), dtype=np.float32)
        # Floor in float32 first: subtracting an int64 array from float32 would silently give float64.
        x0f = np.floor(x)
        y0f = np.floor(y)
        wx = x - x0f
        wy = y - y0f
        # The four corner weights of bilinear interpolation, computed once and reused for every image.
        self.w11 = wx * wy
        self.w01 = wx - self.w11             # wx·(1-wy)
        self.w10 = wy - self.w11             # (1-wx)·wy
        self.w00 = 1.0 - wx - wy + self.w11  # (1-wx)·(1-wy)
        # Flat index of the top-left neighbour. The other three are the same index into the source
        # shifted by 1, w and w+1 (see _sample_plane). On the last column/row the coordinate was
        # clipped to exactly w-1 / h-1, so wx / wy are 0 and those neighbours get zero weight:
        # whatever they read (the next row, or padding) doesn't matter. That's the edge clamp.
        self.i00 = y0f.astype(np.intp) * src_w + x0f.astype(np.intp)
        self.src_shape = (src_h, src_w)

    def __call__(self, img: np.ndarray) -> np.ndarray:
        if img.shape[:2] != self.src_shape:
            raise ValueError(f"image is {img.shape[:2]}, sampler was built for {self.src_shape}")
        if img.ndim == 3:
            # One contiguous plane per channel: NumPy is much faster on long inner loops than on
            # an innermost axis of length 2 or 3.
            out = np.empty((*self.i00.shape, img.shape[2]), dtype=np.float32)
            for c in range(img.shape[2]):
                out[..., c] = self._sample_plane(np.ascontiguousarray(img[..., c]))
            return out
        return self._sample_plane(img)

    def _sample_plane(self, plane: np.ndarray) -> np.ndarray:
        n = plane.size
        w = self.src_shape[1]
        # Pad by one row + one pixel so the shifted reads below never run off the end.
        flat = np.zeros(n + w + 1, dtype=plane.dtype)
        flat[:n] = plane.reshape(-1)
        # np.take is several times faster than fancy indexing (flat[idx]) for big gathers.
        # uint8 · float32 gives float32, so each line is a single pass with no separate cast.
        out = np.take(flat, self.i00) * self.w00
        out += np.take(flat[1:], self.i00) * self.w01
        out += np.take(flat[w:], self.i00) * self.w10
        out += np.take(flat[w + 1:], self.i00) * self.w11
        return out


def remap(img: np.ndarray, map_x: np.ndarray, map_y: np.ndarray) -> np.ndarray:
    return Sampler(map_x, map_y, img.shape[0], img.shape[1])(img)


def warp_by_flow(img: np.ndarray, flow: np.ndarray) -> np.ndarray:
    """out(x) = img(x + flow(x)). Backward warping: pulls pixels from img along the flow."""
    xs, ys = identity_grid(flow.shape[0], flow.shape[1])
    return remap(img, xs + flow[..., 0], ys + flow[..., 1])


_upscale_cache: dict[tuple[int, int, int, int, int], Sampler] = {}


def _upscale_sampler(src_h: int, src_w: int, out_h: int, out_w: int, scale: int) -> Sampler:
    """The resize map only depends on the sizes, so it is built once and reused for every frame."""
    key = (src_h, src_w, out_h, out_w, scale)
    sampler = _upscale_cache.get(key)
    if sampler is None:
        xs, ys = identity_grid(out_h, out_w)
        sampler = Sampler(xs / scale, ys / scale, src_h, src_w)
        if len(_upscale_cache) > 8:
            _upscale_cache.clear()
        _upscale_cache[key] = sampler
    return sampler


def upscale(img: np.ndarray, out_h: int, out_w: int, scale: int) -> np.ndarray:
    """Resize a pyramid level back up by `scale` (a power of two): pixel x up here ↔ x / scale down there."""
    if scale == 1 and img.shape[:2] == (out_h, out_w):
        return img
    return _upscale_sampler(img.shape[0], img.shape[1], out_h, out_w, scale)(img)


def upscale_flow(flow: np.ndarray, out_h: int, out_w: int, scale: int) -> np.ndarray:
    """Resize the field AND scale the vectors: 3 px of motion at half size is 6 px at full size."""
    if scale == 1 and flow.shape[:2] == (out_h, out_w):
        return flow
    return upscale(flow, out_h, out_w, scale) * np.float32(scale)
