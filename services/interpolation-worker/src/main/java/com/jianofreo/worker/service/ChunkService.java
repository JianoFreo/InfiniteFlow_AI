package com.jianofreo.worker.service;

import com.jianofreo.worker.client.JobClient;
import com.jianofreo.worker.config.WorkerProperties;
import com.jianofreo.worker.dto.engine.EngineResult;
import com.jianofreo.worker.dto.message.ChunkTask;
import com.jianofreo.worker.messaging.ProgressPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/**
 * What happens to one chunk, and what to tell RabbitMQ afterwards.
 *
 *  - job cancelled / deleted / no longer active  → skip, ACK
 *  - engine finished                             → report DONE, then ACK (never ACK before DONE is out:
 *                                                  if this replica dies first, the chunk is redelivered)
 *  - engine cancelled                            → ACK
 *  - engine failed, first attempt                → REQUEUE (another replica, or this one, retries once)
 *  - engine failed, second attempt               → report FAILED, REJECT (→ dead-letter queue)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChunkService {

    public enum Outcome { ACK, REQUEUE, REJECT }

    private final EngineRunner engineRunner;
    private final ProgressPublisher progressPublisher;
    private final CancelRegistry cancelRegistry;
    private final JobClient jobClient;
    private final WorkerProperties props;

    public Outcome process(ChunkTask task, boolean redelivered) {
        int jobId = task.getJobId();
        if (cancelRegistry.isCancelled(jobId) || !jobClient.isJobActive(jobId)) {
            log.info("chunk_skipped job={} chunk={} (job no longer active)", jobId, task.getChunkIndex());
            return Outcome.ACK;
        }

        long started = System.nanoTime();
        long intervalNanos = TimeUnit.MILLISECONDS.toNanos(props.progressIntervalMs());
        long[] lastReport = {started};
        progressPublisher.progress(task, 0);

        EngineResult result = engineRunner.run(task, framesDone -> {
            long now = System.nanoTime();
            if (now - lastReport[0] >= intervalNanos) {
                lastReport[0] = now;
                progressPublisher.progress(task, framesDone);
            }
        });

        switch (result.status()) {
            case DONE -> {
                progressPublisher.done(task, result.framesDone(), result.outputPath());
                long tookMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
                log.info("chunk_done job={} chunk={} frames={} in {}ms", jobId, task.getChunkIndex(), result.framesDone(), tookMs);
                return Outcome.ACK;
            }
            case CANCELLED -> {
                deleteQuietly(task.getOutputPath());
                log.info("chunk_cancelled job={} chunk={}", jobId, task.getChunkIndex());
                return Outcome.ACK;
            }
            default -> {
                deleteQuietly(task.getOutputPath());
                if (cancelRegistry.isCancelled(jobId)) {
                    // We killed it ourselves because the job was cancelled: not a real failure.
                    log.info("chunk_cancelled job={} chunk={}", jobId, task.getChunkIndex());
                    return Outcome.ACK;
                }
                if (redelivered) {
                    log.error("chunk_failed job={} chunk={} (second attempt) error={}", jobId, task.getChunkIndex(), result.error());
                    progressPublisher.failed(task, result.error());
                    return Outcome.REJECT;
                }
                log.warn("chunk_retry job={} chunk={} error={}", jobId, task.getChunkIndex(), result.error());
                return Outcome.REQUEUE;
            }
        }
    }

    private static void deleteQuietly(String path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(Path.of(path));
        } catch (IOException e) {
            log.warn("could_not_delete path={} error={}", path, e.getMessage());
        }
    }
}
