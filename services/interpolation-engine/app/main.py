"""Entry point: `python -m app.main` starts one engine replica."""
from __future__ import annotations

import logging
import os

import cv2

from app.consumer import EngineConsumer


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logging.getLogger("pika").setLevel(logging.WARNING)
    logging.getLogger("engine").info("opencv=%s threads=%s", cv2.__version__, cv2.getNumThreads())
    EngineConsumer().run()


if __name__ == "__main__":
    main()
