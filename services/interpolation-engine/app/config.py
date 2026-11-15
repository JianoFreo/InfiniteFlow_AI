"""Engine settings, all from environment variables (set in infra/docker-compose.yml)."""
from __future__ import annotations

import os
import socket

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")
JOB_SERVICE_URL = os.getenv("JOB_SERVICE_URL", "http://localhost:8081").rstrip("/")
WORKER_NAME = os.getenv("WORKER_NAME") or socket.gethostname()

# Queue / exchange names. Must match job-service's RabbitConfig exactly, arguments included.
CHUNK_QUEUE = "interp.chunks"
CHUNK_QUEUE_ARGS = {
    "x-dead-letter-exchange": "interp.dlx",
    "x-dead-letter-routing-key": "interp.chunks.dlq",
}
PROGRESS_QUEUE = "interp.progress"
CANCEL_EXCHANGE = "interp.cancel"

# How often a chunk reports progress (seconds). Lower = smoother bar, more messages.
PROGRESS_INTERVAL = float(os.getenv("PROGRESS_INTERVAL", "0.5"))

# Optical flow is computed on a copy scaled so its longest side is at most this many pixels,
# then the flow is scaled back up. Motion estimation doesn't need full resolution; the warp still uses full-res pixels.
FLOW_MAX_SIDE = int(os.getenv("FLOW_MAX_SIDE", "640"))
# DIS preset: ultrafast | fast | medium. medium is noticeably better on fast motion and still cheap at 640 px.
FLOW_PRESET = os.getenv("FLOW_PRESET", "medium")
# Mean absolute difference (0-255) between two frames above which we treat it as a scene cut.
SCENE_CUT_THRESHOLD = float(os.getenv("SCENE_CUT_THRESHOLD", "40"))

# CPU threads ONE replica may use (OpenCV + x264). 0 = all cores.
# With N replicas on one machine set it to about cores / N. Otherwise the replicas fight over the
# same cores and the whole system gets SLOWER than a single replica (measured: 2 replicas x 12 threads
# on 12 cores ran each chunk at ~6 fps instead of ~17).
ENGINE_THREADS = int(os.getenv("ENGINE_THREADS", "0"))

# Encoder settings for each processed chunk. All chunks of a job MUST use the same settings,
# because media-service joins them without re-encoding.
X264_PRESET = os.getenv("X264_PRESET", "veryfast")
X264_CRF = int(os.getenv("X264_CRF", "18"))
