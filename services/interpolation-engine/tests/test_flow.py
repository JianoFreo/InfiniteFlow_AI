"""The flow interpolator must move objects, not cross-fade them."""
import numpy as np

from app.flow import BlendInterpolator, FlowInterpolator


def textured_frame(square_x, size=(180, 320)):
    """A noisy background (so flow has texture to lock on) with a bright square at square_x."""
    rng = np.random.default_rng(7)
    frame = (rng.integers(0, 60, size=(*size, 1), dtype=np.uint8)).repeat(3, axis=2)
    frame = np.ascontiguousarray(frame)
    frame[70:110, square_x:square_x + 40] = (230, 230, 230)
    return frame


def square_center_x(frame):
    bright = frame[:, :, 0] > 180
    cols = np.where(bright.any(axis=0))[0]
    return (cols.min() + cols.max()) / 2


def test_flow_places_square_halfway():
    a, b = textured_frame(100), textured_frame(130)  # square moves +30 px
    middle = FlowInterpolator(max_side=640).between(a, b, 2)[0]
    assert abs(square_center_x(middle) - (120 + 15)) <= 3  # 100+20 → 130+20, halfway = 135


def test_flow_gives_factor_minus_one_frames_with_increasing_position():
    a, b = textured_frame(100), textured_frame(140)
    frames = FlowInterpolator(max_side=640).between(a, b, 4)
    assert len(frames) == 3
    xs = [square_center_x(f) for f in frames]
    assert xs == sorted(xs)


def test_downscaled_flow_still_tracks_motion():
    a, b = textured_frame(100), textured_frame(130)
    middle = FlowInterpolator(max_side=160).between(a, b, 2)[0]  # flow computed at half size
    assert abs(square_center_x(middle) - 135) <= 4


def test_blend_ghosts_instead():
    a, b = textured_frame(60), textured_frame(200)  # far enough apart that the squares don't overlap
    middle = BlendInterpolator().between(a, b, 2)[0]
    # cross-fade: both squares half visible, nothing fully bright
    assert not (middle[:, :, 0] > 200).any()


def test_scene_cut_repeats_nearest_frame():
    a = np.zeros((90, 160, 3), np.uint8)
    b = np.full((90, 160, 3), 255, np.uint8)
    frames = FlowInterpolator(scene_cut_threshold=40).between(a, b, 4)
    assert frames[0] is a and frames[2] is b
