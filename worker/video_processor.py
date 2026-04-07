from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass(frozen=True)
class VideoMeta:
    fps: float
    width: int
    height: int
    frame_count: int


def _ensure_factor(factor: int) -> None:
    if factor not in (2, 4):
        raise ValueError("Interpolation factor must be 2 or 4")


def _ensure_method(method: str) -> str:
    normalized = method.lower().strip()
    if normalized not in ("linear", "optical_flow"):
        raise ValueError("Method must be 'linear' or 'optical_flow'")
    return normalized


def extract_frames(input_video: Path, frames_dir: Path, jpeg_quality: int = 92) -> VideoMeta:
    frames_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(input_video))
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video: {input_video}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    index = 0
    write_params = [int(cv2.IMWRITE_JPEG_QUALITY), int(jpeg_quality)]

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_path = frames_dir / f"frame_{index:08d}.jpg"
        cv2.imwrite(str(frame_path), frame, write_params)
        index += 1

    cap.release()

    if index < 2:
        raise RuntimeError("Video must contain at least two frames")

    return VideoMeta(fps=fps, width=width, height=height, frame_count=index)


def _blend_linear(frame_a: np.ndarray, frame_b: np.ndarray, alpha: float) -> np.ndarray:
    return cv2.addWeighted(frame_a, 1.0 - alpha, frame_b, alpha, 0.0)


def _blend_optical_flow(frame_a: np.ndarray, frame_b: np.ndarray, alpha: float) -> np.ndarray:
    a_gray = cv2.cvtColor(frame_a, cv2.COLOR_BGR2GRAY)
    b_gray = cv2.cvtColor(frame_b, cv2.COLOR_BGR2GRAY)

    flow = cv2.calcOpticalFlowFarneback(
        a_gray,
        b_gray,
        None,
        pyr_scale=0.5,
        levels=3,
        winsize=15,
        iterations=3,
        poly_n=5,
        poly_sigma=1.2,
        flags=0,
    )

    h, w = a_gray.shape
    grid_x, grid_y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))

    map_x = grid_x + (flow[..., 0] * alpha)
    map_y = grid_y + (flow[..., 1] * alpha)

    warped_a = cv2.remap(frame_a, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return cv2.addWeighted(warped_a, 1.0 - alpha, frame_b, alpha, 0.0)


def generate_interpolated_frames(
    source_frames_dir: Path,
    output_frames_dir: Path,
    frame_count: int,
    factor: int,
    method: str = "linear",
    jpeg_quality: int = 92,
) -> int:
    _ensure_factor(factor)
    method = _ensure_method(method)

    output_frames_dir.mkdir(parents=True, exist_ok=True)
    write_params = [int(cv2.IMWRITE_JPEG_QUALITY), int(jpeg_quality)]

    out_index = 0

    for i in range(frame_count - 1):
        frame_a = cv2.imread(str(source_frames_dir / f"frame_{i:08d}.jpg"))
        frame_b = cv2.imread(str(source_frames_dir / f"frame_{i + 1:08d}.jpg"))

        if frame_a is None or frame_b is None:
            raise RuntimeError(f"Missing decoded frame pair around index {i}")

        cv2.imwrite(str(output_frames_dir / f"frame_{out_index:08d}.jpg"), frame_a, write_params)
        out_index += 1

        for step in range(1, factor):
            alpha = step / float(factor)
            if method == "optical_flow":
                in_between = _blend_optical_flow(frame_a, frame_b, alpha)
            else:
                in_between = _blend_linear(frame_a, frame_b, alpha)
            cv2.imwrite(str(output_frames_dir / f"frame_{out_index:08d}.jpg"), in_between, write_params)
            out_index += 1

    last_frame = cv2.imread(str(source_frames_dir / f"frame_{frame_count - 1:08d}.jpg"))
    if last_frame is None:
        raise RuntimeError("Last frame is missing")

    cv2.imwrite(str(output_frames_dir / f"frame_{out_index:08d}.jpg"), last_frame, write_params)
    return out_index + 1


def _has_audio(input_video: Path) -> bool:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=index",
        "-of",
        "csv=p=0",
        str(input_video),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return bool(result.stdout.strip())


def assemble_video_with_ffmpeg(
    frames_dir: Path,
    fps: float,
    factor: int,
    output_video: Path,
    source_video_for_audio: Path | None = None,
    crf: int = 20,
    preset: str = "veryfast",
) -> None:
    _ensure_factor(factor)

    output_video.parent.mkdir(parents=True, exist_ok=True)
    temp_video = output_video.with_name(f"{output_video.stem}.silent.mp4")

    output_fps = max(1.0, float(fps) * factor)
    frame_pattern = str(frames_dir / "frame_%08d.jpg")

    base_cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        f"{output_fps:.6f}",
        "-i",
        frame_pattern,
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        str(crf),
        "-pix_fmt",
        "yuv420p",
        str(temp_video),
    ]
    subprocess.run(base_cmd, check=True)

    if source_video_for_audio is None or not _has_audio(source_video_for_audio):
        shutil.move(str(temp_video), str(output_video))
        return

    mux_cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(temp_video),
        "-i",
        str(source_video_for_audio),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        str(output_video),
    ]
    subprocess.run(mux_cmd, check=True)
    temp_video.unlink(missing_ok=True)


def process_video(
    input_video: Path,
    output_video: Path,
    factor: int = 2,
    method: str = "linear",
    keep_temp: bool = False,
    temp_root: Path | None = None,
) -> None:
    _ensure_factor(factor)
    method = _ensure_method(method)

    base_temp = temp_root or Path(tempfile.mkdtemp(prefix="interp_"))
    extracted_dir = base_temp / "source_frames"
    output_frames_dir = base_temp / "output_frames"

    try:
        meta = extract_frames(input_video=input_video, frames_dir=extracted_dir)
        generate_interpolated_frames(
            source_frames_dir=extracted_dir,
            output_frames_dir=output_frames_dir,
            frame_count=meta.frame_count,
            factor=factor,
            method=method,
        )
        assemble_video_with_ffmpeg(
            frames_dir=output_frames_dir,
            fps=meta.fps,
            factor=factor,
            output_video=output_video,
            source_video_for_audio=input_video,
        )
    finally:
        if not keep_temp:
            shutil.rmtree(base_temp, ignore_errors=True)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Video interpolation processor")
    parser.add_argument("--input", required=True, help="Input video path")
    parser.add_argument("--output", required=True, help="Output video path")
    parser.add_argument("--factor", type=int, default=2, choices=[2, 4], help="Interpolation factor")
    parser.add_argument(
        "--method",
        type=str,
        default="linear",
        choices=["linear", "optical_flow"],
        help="Interpolation method",
    )
    parser.add_argument("--keep-temp", action="store_true", help="Keep temporary extracted/generated frames")
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    process_video(
        input_video=Path(args.input),
        output_video=Path(args.output),
        factor=args.factor,
        method=args.method,
        keep_temp=args.keep_temp,
    )
