package com.jianofreo.job.service;

import com.jianofreo.job.config.AppProperties;
import com.jianofreo.job.dto.engine.ChunkTask;
import com.jianofreo.job.dto.engine.EngineResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Runs the chunks of a job on the engine thread pool. This replaces RabbitMQ and the old worker service:
 * job-service now starts the Python engine itself.
 *
 *   start(tasks)  puts one task per chunk into the pool. Free threads take them; the rest wait their turn.
 *   cancel(jobId) stops the running engines of that job and makes the waiting chunks skip themselves.
 *
 * What each chunk does:  check the job is still alive -> run the engine -> tell JobProgressService what happened.
 * A chunk that fails is tried once more before the whole job is marked failed.
 */
@Slf4j
@Service
public class JobRunner {

    private static final Duration CANCEL_MEMORY = Duration.ofHours(1);
    private static final int ATTEMPTS = 2;

    private final ExecutorService chunkExecutor;
    private final EngineRunner engineRunner;
    private final JobProgressService jobProgressService;
    private final AppProperties props;
    private final LocalFiles localFiles;

    /** Jobs cancelled recently, so chunks still waiting in the pool skip themselves. */
    private final Map<Integer, Instant> cancelled = new ConcurrentHashMap<>();

    public JobRunner(ExecutorService chunkExecutor, EngineRunner engineRunner,
                     JobProgressService jobProgressService, AppProperties props, LocalFiles localFiles) {
        this.chunkExecutor = chunkExecutor;
        this.engineRunner = engineRunner;
        this.jobProgressService = jobProgressService;
        this.props = props;
        this.localFiles = localFiles;
    }

    public void start(List<ChunkTask> tasks) {
        for (ChunkTask task : tasks) {
            chunkExecutor.submit(() -> runChunk(task));
        }
    }

    public void cancel(int jobId) {
        Instant now = Instant.now();
        cancelled.put(jobId, now);
        cancelled.values().removeIf(at -> at.isBefore(now.minus(CANCEL_MEMORY)));
        engineRunner.cancelJob(jobId);
    }

    private boolean isCancelled(int jobId) {
        return cancelled.containsKey(jobId);
    }

    private void runChunk(ChunkTask task) {
        int jobId = task.getJobId();
        try {
            if (isCancelled(jobId) || !jobProgressService.chunkStarted(task, Thread.currentThread().getName())) {
                log.info("chunk_skipped job={} chunk={} (job no longer active)", jobId, task.getChunkIndex());
                return;
            }

            long started = System.nanoTime();
            String lastError = null;
            for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
                EngineResult result = runEngine(task);

                if (result.status() == EngineResult.Status.DONE) {
                    jobProgressService.chunkDone(task, result.framesDone(), result.outputPath());
                    log.info("chunk_done job={} chunk={} frames={} in {}ms", jobId, task.getChunkIndex(),
                            result.framesDone(), TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
                    return;
                }
                deleteQuietly(task.getOutputPath());
                if (result.status() == EngineResult.Status.CANCELLED || isCancelled(jobId)) {
                    log.info("chunk_cancelled job={} chunk={}", jobId, task.getChunkIndex());
                    return; // we stopped it ourselves: not a failure
                }
                lastError = result.error();
                log.warn("chunk_failed job={} chunk={} attempt={} error={}", jobId, task.getChunkIndex(), attempt, lastError);
            }

            jobProgressService.chunkFailed(task, lastError);
            cancel(jobId); // the job failed: stop its other chunks too
        } catch (RuntimeException e) {
            // A bug here must not kill the pool thread silently: fail the job so the user sees it.
            log.error("chunk_crashed job={} chunk={}", jobId, task.getChunkIndex(), e);
            jobProgressService.chunkFailed(task, "internal error: " + e.getMessage());
            cancel(jobId);
        }
    }

    /** Gets the source video onto this machine, then runs the engine. A failed download is a failed attempt. */
    private EngineResult runEngine(ChunkTask task) {
        try {
            localFiles.ensureSource(task);
        } catch (RuntimeException e) {
            return EngineResult.failed("could not download the source video: " + e.getMessage());
        }
        return engineRunner.run(task, throttled(task));
    }

    /** The engine reports after every frame pair; only pass one report on per progress interval. */
    private java.util.function.IntConsumer throttled(ChunkTask task) {
        long intervalNanos = TimeUnit.MILLISECONDS.toNanos(props.progressIntervalMs());
        long[] lastReport = {System.nanoTime()};
        return framesDone -> {
            long now = System.nanoTime();
            if (now - lastReport[0] >= intervalNanos) {
                lastReport[0] = now;
                jobProgressService.chunkProgress(task, framesDone);
            }
        };
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
