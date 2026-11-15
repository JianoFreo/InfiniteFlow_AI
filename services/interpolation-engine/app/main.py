"""Entry point: `python -m app.main` starts one engine replica."""
from __future__ import annotations

import logging
import os

import cv2

from app import config
from app.consumer import EngineConsumer


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    # pika logs every failed socket while RabbitMQ is still starting; the engine logs its own retry line
    logging.getLogger("pika").setLevel(logging.CRITICAL)
    if config.ENGINE_THREADS > 0:
        cv2.setNumThreads(config.ENGINE_THREADS)
    logging.getLogger("engine").info("opencv=%s threads=%s", cv2.__version__, cv2.getNumThreads())
    EngineConsumer().run()


if __name__ == "__main__":
    main()
