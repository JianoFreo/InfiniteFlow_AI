"""Unit tests for the hand-written math in app/engine/. Synthetic images with KNOWN motion,
so every check compares against ground truth instead of eyeballing output."""
from pathlib import Path

import numpy as np
import pytest

from app.engine.flow import PRESETS, estimate_flow, median3
from app.engine.image import gradients, to_gray
from app.engine.occlusion import occlusion_mask
from app.engine.pyramid import box_filter, build_pyramid, gaussian_blur, gaussian_kernel
from app.engine.warp import remap, upscale_flow, warp_by_flow
from app.flow import FlowInterpolator


def sinusoid_texture(h, w, dx=0.0, dy=0.0, seed=3):
    """Smooth, richly textured image defined analytically, so a sub-pixel shift is EXACT:
    texture(x, y) shifted by (dx, dy) = texture(x - dx, y - dy)."""
    rng = np.random.default_rng(seed)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
    img = np.zeros((h, w))
    for _ in range(12):
        fx, fy = rng.uniform(-0.25, 0.25, size=2)
        phase = rng.uniform(0, 2 * np.pi)
        img += rng.uniform(5, 15) * np.sin(fx * (xs - dx) + fy * (ys - dy) + phase)
    return (128 + img).astype(np.float32)


# ---- filters -----------------------------------------------------------------------------

def test_gaussian_kernel_is_normalised_and_symmetric():
    k = gaussian_kernel(1.5)
    assert abs(k.sum() - 1.0) < 1e-6
    assert np.allclose(k, k[::-1])


def test_box_filter_matches_naive_mean():
    img = np.random.default_rng(0).uniform(0, 255, size=(20, 30)).astype(np.float32)
    r = 2
    padded = np.pad(img, r, mode="edge")
    naive = np.array([[padded[y:y + 2 * r + 1, x:x + 2 * r + 1].mean() for x in range(30)] for y in range(20)])
    assert np.allclose(box_filter(img, r), naive, atol=1e-3)


def test_blur_keeps_constant_image_constant():
    img = np.full((15, 17, 3), 42.0, dtype=np.float32)
    assert np.allclose(gaussian_blur(img, 2.0), 42.0)


def test_pyramid_halves_each_level_and_respects_min_side():
    levels = build_pyramid(np.zeros((181, 320), np.float32), min_side=12)
    assert [lvl.shape for lvl in levels] == [(181, 320), (91, 160), (46, 80), (23, 40), (12, 20)]


def test_gradients_of_a_ramp():
    ys, xs = np.mgrid[0:10, 0:12].astype(np.float32)
    gx, gy = gradients(3 * xs - 2 * ys)
    assert np.allclose(gx[:, 1:-1], 3) and np.allclose(gy[1:-1, :], -2)


def test_to_gray_uses_bgr_weights():
    frame = np.zeros((1, 3, 3), np.uint8)
    frame[0, 0] = (255, 0, 0)  # blue
    frame[0, 1] = (0, 255, 0)  # green
    frame[0, 2] = (0, 0, 255)  # red
    assert np.allclose(to_gray(frame)[0], [0.114 * 255, 0.587 * 255, 0.299 * 255], atol=0.01)


# ---- warping -----------------------------------------------------------------------------

def test_remap_identity_returns_image():
    img = np.random.default_rng(1).integers(0, 255, size=(9, 11, 3)).astype(np.uint8)
    ys, xs = np.mgrid[0:9, 0:11].astype(np.float32)
    assert np.array_equal(remap(img, xs, ys), img.astype(np.float32))


def test_remap_is_exact_on_linear_ramp_at_subpixel_positions():
    ys, xs = np.mgrid[0:8, 0:10].astype(np.float32)
    ramp = 2 * xs + 5 * ys
    out = remap(ramp, xs[:, :-1] + 0.25, ys[:, :-1] + 0.5)
    assert np.allclose(out, 2 * (xs[:, :-1] + 0.25) + 5 * np.minimum(ys[:, :-1] + 0.5, 7), atol=1e-4)


def test_remap_clamps_outside_coordinates_to_edges():
    img = np.arange(12, dtype=np.float32).reshape(3, 4)
    out = remap(img, np.array([[-5.0, 10.0]], np.float32), np.array([[-5.0, 10.0]], np.float32))
    assert out.tolist() == [[0.0, 11.0]]


def test_warp_by_integer_flow_shifts_image():
    img = sinusoid_texture(20, 30)
    flow = np.zeros((20, 30, 2), np.float32)
    flow[..., 0] = 3  # out(x) = img(x + 3)
    assert np.allclose(warp_by_flow(img, flow)[:, :-3], img[:, 3:])


def test_upscale_flow_scales_vectors():
    flow = np.full((5, 6, 2), 1.5, np.float32)
    up = upscale_flow(flow, 20, 24, 4)
    assert up.shape == (20, 24, 2) and np.allclose(up, 6.0)


# ---- optical flow --------------------------------------------------------------------------

@pytest.mark.parametrize("dx,dy", [(1.5, -0.5), (6.0, 3.0), (-14.0, 9.5)])
def test_flow_recovers_known_global_shift(dx, dy):
    h, w = 120, 160
    a = sinusoid_texture(h, w)
    b = sinusoid_texture(h, w, dx, dy)  # content of a moved by (dx, dy)
    flow = estimate_flow(build_pyramid(a), build_pyramid(b), PRESETS["medium"])
    inner = flow[20:-20, 20:-20]  # borders have no partner pixels when content moves
    err = np.hypot(inner[..., 0] - dx, inner[..., 1] - dy)
    assert np.median(err) < 0.15
    assert np.percentile(err, 95) < 0.5


def test_flow_is_zero_for_identical_frames():
    a = sinusoid_texture(64, 80)
    flow = estimate_flow(build_pyramid(a), build_pyramid(a), PRESETS["fast"])
    assert np.abs(flow).max() < 1e-3


def test_flow_on_downscaled_level_upscales_correctly():
    a = sinusoid_texture(160, 240)
    b = sinusoid_texture(160, 240, 8.0, -4.0)
    pa, pb = build_pyramid(a), build_pyramid(b)
    flow = upscale_flow(estimate_flow(pa, pb, PRESETS["medium"], finest_level=1), 160, 240, 2)
    inner = flow[30:-30, 30:-30]
    assert abs(np.median(inner[..., 0]) - 8.0) < 0.3
    assert abs(np.median(inner[..., 1]) + 4.0) < 0.3


def test_median3_sorting_network_matches_numpy_median():
    field = np.random.default_rng(5).normal(size=(23, 31, 2)).astype(np.float32)
    p = np.pad(field, ((1, 1), (1, 1), (0, 0)), mode="edge")
    stack = np.stack([p[dy:dy + 23, dx:dx + 31] for dy in range(3) for dx in range(3)])
    assert np.array_equal(median3(field), np.median(stack, axis=0).astype(np.float32))


def test_median3_removes_single_outlier():
    field = np.zeros((7, 7, 2), np.float32)
    field[3, 3] = 100
    assert np.abs(median3(field)).max() == 0


# ---- occlusion -----------------------------------------------------------------------------

def test_consistent_flow_has_no_occlusion_except_where_it_leaves_the_frame():
    f = np.zeros((40, 50, 2), np.float32)
    f[..., 0] = 4
    mask = occlusion_mask(f, -f, soften_sigma=0.5)
    assert mask[:, :40].max() < 0.05   # these land inside the frame and point back consistently
    assert mask[:, -2:].min() > 0.5    # x + 4 > 49: leaves the picture


def test_inconsistent_flow_is_occluded():
    f_ab = np.zeros((30, 30, 2), np.float32)
    f_ba = np.zeros((30, 30, 2), np.float32)
    f_ab[10:20, 10:20, 0] = 5  # A says "moves right", B says "didn't move" → disagreement
    mask = occlusion_mask(f_ab, f_ba, soften_sigma=0.5)
    assert mask[12:18, 12:18].min() > 0.5
    assert mask[:5, :5].max() < 0.05


# ---- full interpolator ---------------------------------------------------------------------

def moving_object(x, size=(120, 200)):
    """Bright 24x24 square at column x over a smooth, textured background (static)."""
    bg = sinusoid_texture(*size, seed=11) * 0.3
    frame = np.repeat(bg[..., None], 3, axis=2)
    frame[48:72, x:x + 24] = 235
    return np.clip(frame, 0, 255).astype(np.uint8)


def bright_columns(frame):
    return np.where((frame[..., 0] > 190).any(axis=0))[0]


@pytest.mark.parametrize("factor", [2, 3, 4, 8])
def test_interpolated_object_is_solid_at_the_right_place(factor):
    a, b = moving_object(60), moving_object(100)  # +40 px
    frames = FlowInterpolator(max_side=640).between(a, b, factor)
    assert len(frames) == factor - 1
    for k, frame in enumerate(frames, start=1):
        assert frame.dtype == np.uint8 and frame.shape == a.shape
        expected_center = 60 + 12 + 40 * k / factor
        cols = bright_columns(frame)
        assert abs((cols.min() + cols.max()) / 2 - expected_center) <= 2.5
        # Drawn once at full width: a cross-fade would leave two faint squares and no bright pixels.
        assert cols.max() - cols.min() + 1 >= 20


def test_interpolator_does_not_use_opencv():
    root = Path(__file__).resolve().parents[1] / "app"
    offenders = [p.name for p in root.rglob("*.py") if "import cv2" in p.read_text(encoding="utf-8")]
    assert offenders == []
