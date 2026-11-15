"""Run the pipeline on one file without RabbitMQ, for benchmarking and debugging.

    python -m app.cli input.mp4 output.mp4 --factor 4 [--mode flow|blend] [--chunk-frames 60]

With --chunk-frames the video is processed in chunks exactly like the distributed system does
(sequentially here) and joined with the concat demuxer, which is a quick way to check for seams.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
import time
from fractions import Fraction

from app import config
from app.flow import create_interpolator
from app.pipeline import ChunkTask, process_chunk


def probe(path: str) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-print_format", "json", "-show_streams", path],
        check=True, capture_output=True, text=True,
    ).stdout
    stream = json.loads(out)["streams"][0]
    fps = stream.get("avg_frame_rate") or stream["r_frame_rate"]
    if Fraction(fps) == 0:
        fps = stream["r_frame_rate"]
    frames = int(stream.get("nb_frames") or 0) or round(float(stream["duration"]) * float(Fraction(fps)))
    return {"fps": fps, "width": int(stream["width"]), "height": int(stream["height"]), "frames": frames}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--factor", type=int, default=2)
    parser.add_argument("--mode", choices=["flow", "blend"], default="flow")
    parser.add_argument("--chunk-frames", type=int, default=0, help="0 = whole video as one chunk")
    args = parser.parse_args()

    if config.ENGINE_THREADS > 0:
        import cv2
        cv2.setNumThreads(config.ENGINE_THREADS)

    info = probe(args.input)
    total = info["frames"]
    size = args.chunk_frames or total
    interpolator = create_interpolator(args.mode, config.FLOW_MAX_SIDE, config.FLOW_PRESET, config.SCENE_CUT_THRESHOLD)

    workdir = tempfile.mkdtemp(prefix="engine-cli-")
    started = time.monotonic()
    chunk_paths, written = [], 0
    starts = list(range(0, total, size))
    for index, start in enumerate(starts):
        last = index == len(starts) - 1
        task = ChunkTask(0, index, os.path.abspath(args.input), start, min(size, total - start), last,
                         args.factor, args.mode, info["fps"], info["width"], info["height"],
                         os.path.join(workdir, f"chunk_{index:05d}.mp4"))
        result = process_chunk(task, interpolator, x264_preset=config.X264_PRESET, x264_crf=config.X264_CRF,
                               threads=config.ENGINE_THREADS)
        written += result.frames_written
        if result.output_path:
            chunk_paths.append(result.output_path)

    list_file = os.path.join(workdir, "list.txt")
    with open(list_file, "w") as fh:
        fh.writelines(f"file '{p}'\n" for p in chunk_paths)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list_file,
                    "-c", "copy", args.output], check=True)
    elapsed = time.monotonic() - started

    print(json.dumps({
        "input": args.input, "width": info["width"], "height": info["height"], "fps": info["fps"],
        "source_frames": total, "output_frames": written,
        "expected_output_frames": (total - 1) * args.factor + 1,
        "chunks": len(starts), "mode": args.mode, "factor": args.factor,
        "seconds": round(elapsed, 2), "source_fps_processed": round(total / elapsed, 1),
    }, indent=2))


if __name__ == "__main__":
    main()
