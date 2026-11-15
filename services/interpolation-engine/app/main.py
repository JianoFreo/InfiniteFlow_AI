"""Entry point: `python -m app.main` starts one engine replica."""
from __future__ import annotations

import logging
import os

import numpy as np

from app import config
from app.consumer import EngineConsumer


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    # pika logs every failed socket while RabbitMQ is still starting; the engine logs its own retry line
    logging.getLogger("pika").setLevel(logging.CRITICAL)
    logging.getLogger("engine").info(
        "engine=numpy-handwritten numpy=%s flow_preset=%s flow_max_side=%s",
        np.__version__, config.FLOW_PRESET, config.FLOW_MAX_SIDE,
    )
    EngineConsumer().run()


if __name__ == "__main__":
    main()
