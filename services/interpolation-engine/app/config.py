"""Algorithm settings, all from environment variables.

The Java interpolation-worker starts the engine as a child process, so these are inherited from the
worker container's environment (set in infra/docker-compose.yml). Only processing settings live here:
queues, retries, progress reporting and service URLs belong to the Java worker.
"""
from __future__ import annotations

import os

# Optical flow is computed on a copy scaled so its longest side is at most this many pixels,
# then the flow is scaled back up. Motion estimation doesn't need full resolution; the warp still uses full-res pixels.
FLOW_MAX_SIDE = int(os.getenv("FLOW_MAX_SIDE", "640"))
# Flow quality preset: ultrafast | fast | medium (see app/engine/flow.py PRESETS). medium = best quality.
FLOW_PRESET = os.getenv("FLOW_PRESET", "medium")
# Mean absolute difference (0-255) between two frames above which we treat it as a scene cut.
SCENE_CUT_THRESHOLD = float(os.getenv("SCENE_CUT_THRESHOLD", "40"))

# CPU threads one chunk may give ffmpeg/x264. 0 = all cores. (The NumPy math itself runs on one core.)
# With N worker replicas on one machine set it to about cores / N, otherwise they fight over the same cores.
ENGINE_THREADS = int(os.getenv("ENGINE_THREADS", "0"))

# Encoder settings for each processed chunk. All chunks of a job MUST use the same settings,
# because media-service joins them without re-encoding.
X264_PRESET = os.getenv("X264_PRESET", "veryfast")
X264_CRF = int(os.getenv("X264_CRF", "18"))
