from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def interpolate_video(input_path: Path, output_path: Path, factor: int) -> float:
    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open input video: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(output_path), fourcc, fps * factor, (width, height))

    ok, prev = cap.read()
    if not ok:
        cap.release()
        out.release()
        raise RuntimeError("Input video has no readable frames")

    while True:
        ok, curr = cap.read()
        if not ok:
            break

        out.write(prev)
        for step in range(1, factor):
            alpha = step / float(factor)
            blended = cv2.addWeighted(prev, 1.0 - alpha, curr, alpha, 0.0)
            out.write(np.ascontiguousarray(blended))
        prev = curr

    out.write(prev)

    cap.release()
    out.release()
    return fps
