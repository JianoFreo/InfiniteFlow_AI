"""RabbitMQ side of the engine.

Threads (pika connections are NOT thread-safe, so each thread owns its own connection):

  main thread      consumes interp.chunks with prefetch=1 (one chunk at a time per replica) and keeps the
                   connection's heartbeats going while a chunk is being processed
  work thread      one per chunk: runs the pipeline, then asks the main thread to ack via add_callback_threadsafe
  publisher thread sends progress / done / failed reports to interp.progress
  cancel thread    listens on the interp.cancel fanout and remembers cancelled job ids

Delivery guarantees:
  - a chunk is acked only AFTER its DONE report is published. If the replica dies mid-chunk,
    RabbitMQ re-delivers the chunk to another replica.
  - a failing chunk is retried once (requeue); the second failure is reported FAILED and the message goes to the DLQ.
"""
from __future__ import annotations

import functools
import json
import logging
import queue
import threading
import time
import urllib.error
import urllib.request

import pika
from pika.adapters.blocking_connection import BlockingChannel

from app import config
from app.flow import create_interpolator
from app.pipeline import Cancelled, ChunkTask, process_chunk

log = logging.getLogger("engine")


def _connection_params(heartbeat: int = 60) -> pika.URLParameters:
    params = pika.URLParameters(config.RABBITMQ_URL)
    params.heartbeat = heartbeat
    params.blocked_connection_timeout = 300
    return params


def _declare_topology(channel: BlockingChannel) -> None:
    channel.queue_declare(config.CHUNK_QUEUE, durable=True, arguments=config.CHUNK_QUEUE_ARGS)
    channel.queue_declare(config.PROGRESS_QUEUE, durable=True)
    channel.exchange_declare(config.CANCEL_EXCHANGE, exchange_type="fanout", durable=True)


class CancelRegistry:
    """Job ids cancelled recently. Checked between frames, so a cancel stops a chunk within one frame pair."""

    TTL_SECONDS = 3600

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cancelled: dict[int, float] = {}

    def add(self, job_id: int) -> None:
        now = time.monotonic()
        with self._lock:
            self._cancelled[job_id] = now
            for jid, at in list(self._cancelled.items()):
                if now - at > self.TTL_SECONDS:
                    del self._cancelled[jid]

    def __contains__(self, job_id: int) -> bool:
        with self._lock:
            return job_id in self._cancelled


class CancelListener(threading.Thread):
    def __init__(self, registry: CancelRegistry) -> None:
        super().__init__(name="cancel-listener", daemon=True)
        self.registry = registry

    def run(self) -> None:
        while True:
            try:
                connection = pika.BlockingConnection(_connection_params())
                channel = connection.channel()
                channel.exchange_declare(config.CANCEL_EXCHANGE, exchange_type="fanout", durable=True)
                # Exclusive, server-named queue: every replica gets its own copy of each cancel.
                own_queue = channel.queue_declare("", exclusive=True).method.queue
                channel.queue_bind(own_queue, config.CANCEL_EXCHANGE)
                channel.basic_consume(own_queue, self._on_cancel, auto_ack=True)
                log.info("cancel_listener_ready")
                channel.start_consuming()
            except Exception as exc:  # noqa: BLE001 - reconnect on anything
                log.warning("cancel_listener_reconnect error=%s", exc)
                time.sleep(3)

    def _on_cancel(self, channel, method, properties, body: bytes) -> None:
        try:
            job_id = int(json.loads(body)["jobId"])
        except (ValueError, KeyError, TypeError):
            return
        self.registry.add(job_id)
        log.info("job_cancel_received job=%s", job_id)


class ProgressPublisher(threading.Thread):
    """Single thread that owns the publishing connection. Other threads just put dicts in a queue."""

    def __init__(self) -> None:
        super().__init__(name="progress-publisher", daemon=True)
        self._queue: queue.Queue[dict] = queue.Queue()

    def send(self, report: dict) -> None:
        self._queue.put(report)

    def run(self) -> None:
        pending: dict | None = None
        while True:
            try:
                connection = pika.BlockingConnection(_connection_params())
                channel = connection.channel()
                _declare_topology(channel)
                log.info("progress_publisher_ready")
                while True:
                    if pending is None:
                        try:
                            pending = self._queue.get(timeout=1.0)
                        except queue.Empty:
                            connection.process_data_events(0)  # keeps heartbeats alive while idle
                            continue
                    final = pending["status"] != "PROGRESS"
                    channel.basic_publish(
                        exchange="",
                        routing_key=config.PROGRESS_QUEUE,
                        body=json.dumps(pending).encode(),
                        properties=pika.BasicProperties(
                            content_type="application/json",
                            delivery_mode=pika.DeliveryMode.Persistent if final else pika.DeliveryMode.Transient,
                        ),
                    )
                    pending = None
            except Exception as exc:  # noqa: BLE001
                log.warning("progress_publisher_reconnect error=%s", exc)
                if pending is not None and pending["status"] == "PROGRESS":
                    pending = None  # a stale progress tick isn't worth retrying; DONE/FAILED are
                time.sleep(2)


def _job_still_active(job_id: int) -> bool:
    """Ask job-service before starting a chunk, so a cancelled/deleted job doesn't burn CPU.
    If job-service is unreachable we process anyway; the result is ignored later if needed."""
    try:
        with urllib.request.urlopen(f"{config.JOB_SERVICE_URL}/jobs/{job_id}", timeout=3) as resp:
            status = json.loads(resp.read()).get("status")
            return status in ("QUEUED", "PROCESSING")
    except urllib.error.HTTPError as exc:
        return exc.code != 404
    except Exception:  # noqa: BLE001
        return True


class EngineConsumer:
    def __init__(self) -> None:
        self.cancelled = CancelRegistry()
        self.publisher = ProgressPublisher()
        # One worker thread at a time (prefetch=1), so a single interpolator per mode is safe to reuse.
        self._interpolators = {
            mode: create_interpolator(mode, config.FLOW_MAX_SIDE, config.FLOW_PRESET, config.SCENE_CUT_THRESHOLD)
            for mode in ("flow", "blend")
        }

    def run(self) -> None:
        self.publisher.start()
        CancelListener(self.cancelled).start()
        while True:
            try:
                connection = pika.BlockingConnection(_connection_params())
                channel = connection.channel()
                _declare_topology(channel)
                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(config.CHUNK_QUEUE, functools.partial(self._on_message, connection))
                log.info("engine_ready worker=%s queue=%s", config.WORKER_NAME, config.CHUNK_QUEUE)
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                log.warning("rabbitmq_unavailable retry_in=3s error=%s", exc)
                time.sleep(3)

    def _on_message(self, connection, channel, method, properties, body: bytes) -> None:
        threading.Thread(
            target=self._work,
            args=(connection, channel, method.delivery_tag, method.redelivered, body),
            name="chunk-worker",
            daemon=True,
        ).start()

    def _work(self, connection, channel, delivery_tag: int, redelivered: bool, body: bytes) -> None:
        def settle(action: str) -> None:
            def do() -> None:
                if not channel.is_open:
                    return  # connection dropped: RabbitMQ will redeliver anyway
                if action == "ack":
                    channel.basic_ack(delivery_tag)
                else:
                    channel.basic_nack(delivery_tag, requeue=(action == "requeue"))
            connection.add_callback_threadsafe(do)

        try:
            task = ChunkTask.from_message(json.loads(body))
        except Exception as exc:  # noqa: BLE001
            log.error("bad_chunk_message error=%s body=%s", exc, body[:200])
            settle("reject")
            return

        if task.job_id in self.cancelled or not _job_still_active(task.job_id):
            log.info("chunk_skipped job=%s chunk=%s (job no longer active)", task.job_id, task.chunk_index)
            settle("ack")
            return

        report = functools.partial(self._report, task)
        last_tick = 0.0

        def on_progress(frames_done: int) -> None:
            nonlocal last_tick
            now = time.monotonic()
            if now - last_tick >= config.PROGRESS_INTERVAL:
                last_tick = now
                report("PROGRESS", framesDone=frames_done)

        started = time.monotonic()
        report("PROGRESS", framesDone=0)
        try:
            result = process_chunk(
                task,
                self._interpolators.get(task.mode, self._interpolators["flow"]),
                progress=on_progress,
                should_stop=lambda: task.job_id in self.cancelled,
                x264_preset=config.X264_PRESET,
                x264_crf=config.X264_CRF,
            )
        except Cancelled:
            log.info("chunk_cancelled job=%s chunk=%s", task.job_id, task.chunk_index)
            settle("ack")
            return
        except Exception as exc:  # noqa: BLE001
            if redelivered:
                log.exception("chunk_failed job=%s chunk=%s (second attempt)", task.job_id, task.chunk_index)
                report("FAILED", error=str(exc)[:500])
                settle("reject")  # → dead-letter queue
            else:
                log.warning("chunk_retry job=%s chunk=%s error=%s", task.job_id, task.chunk_index, exc)
                settle("requeue")
            return

        elapsed = time.monotonic() - started
        report("DONE", framesDone=result.frames_done, outputPath=result.output_path)
        settle("ack")
        log.info(
            "chunk_done job=%s chunk=%s frames=%s→%s in %.2fs (%.1f src fps)",
            task.job_id, task.chunk_index, result.frames_done, result.frames_written, elapsed,
            result.frames_done / elapsed if elapsed > 0 else 0,
        )

    def _report(self, task: ChunkTask, status: str, **fields) -> None:
        self.publisher.send({
            "jobId": task.job_id,
            "chunkIndex": task.chunk_index,
            "status": status,
            "worker": config.WORKER_NAME,
            **fields,
        })
