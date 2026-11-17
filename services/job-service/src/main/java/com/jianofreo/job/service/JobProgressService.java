package com.jianofreo.job.service;

import com.jianofreo.job.client.MediaClient;
import com.jianofreo.job.dto.engine.ChunkTask;
import com.jianofreo.job.entity.ChunkStatus;
import com.jianofreo.job.entity.Job;
import com.jianofreo.job.entity.JobChunk;
import com.jianofreo.job.entity.JobStatus;
import com.jianofreo.job.repository.JobChunkRepository;
import com.jianofreo.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.function.Supplier;

/**
 * Turns "chunk 3 started / is at frame 40 / finished / failed" into job state: chunk rows, job progress,
 * the live event for the browser, and the merge once every chunk is done.
 *
 * Every public method is synchronized: several engine threads report at the same time, and this keeps
 * "was that the LAST chunk?" from being decided twice (which would merge the video twice).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JobProgressService {

    /** Processing covers 0-95 %. The last 5 % is the merge. */
    static final int PROCESSING_SHARE = 95;

    private final JobRepository jobRepository;
    private final JobChunkRepository jobChunkRepository;
    private final ProgressTracker progressTracker;
    private final JobEventPublisher jobEventPublisher;
    private final MergeService mergeService;
    private final MediaClient mediaClient;

    /** A chunk is about to run. Returns false when its job was cancelled, failed or deleted in the meantime. */
    public synchronized boolean chunkStarted(ChunkTask task, String engineName) {
        return withRetry(() -> {
            Job job = activeJob(task.getJobId());
            JobChunk chunk = job == null ? null : findChunk(task);
            if (chunk == null) {
                return false;
            }
            seedTracker(job);

            Instant now = Instant.now();
            chunk.setStatus(ChunkStatus.PROCESSING);
            chunk.setWorker(engineName);
            chunk.setStartedAt(now);
            jobChunkRepository.save(chunk);

            if (job.getStatus() == JobStatus.QUEUED) {
                job.setStatus(JobStatus.PROCESSING);
                job.setStartedAt(now);
            }
            saveAndPublish(job, job.getProgress(), now);
            return true;
        });
    }

    /** The engine finished another frame pair. Only touches the database about twice a second per job. */
    public synchronized void chunkProgress(ChunkTask task, int framesDone) {
        withRetry(() -> {
            Job job = activeJob(task.getJobId());
            JobChunk chunk = job == null ? null : findChunk(task);
            if (chunk == null || chunk.getStatus() == ChunkStatus.COMPLETED) {
                return null;
            }
            seedTracker(job);
            progressTracker.update(job.getId(), chunk.getChunkIndex(), Math.min(framesDone, chunk.getFrameCount()));

            int progress = percent(job);
            if (progress != job.getProgress() && progressTracker.shouldPersist(job.getId())) {
                saveAndPublish(job, progress, Instant.now());
            }
            return null;
        });
    }

    /** A chunk is finished. When it was the last one, the job moves on to merging. */
    public synchronized void chunkDone(ChunkTask task, int framesDone, String outputPath) {
        withRetry(() -> {
            Job job = activeJob(task.getJobId());
            JobChunk chunk = job == null ? null : findChunk(task);
            if (chunk == null) {
                return null;
            }
            seedTracker(job);

            Instant now = Instant.now();
            chunk.setStatus(ChunkStatus.COMPLETED);
            chunk.setOutputPath(outputPath);
            chunk.setFinishedAt(now);
            jobChunkRepository.save(chunk);
            progressTracker.update(job.getId(), chunk.getChunkIndex(), chunk.getFrameCount());

            job.setCompletedChunks(jobChunkRepository.countByJob_IdAndStatus(job.getId(), ChunkStatus.COMPLETED));
            boolean allDone = job.getCompletedChunks().equals(job.getTotalChunks());
            if (allDone) {
                job.setStatus(JobStatus.MERGING);
            }
            saveAndPublish(job, allDone ? PROCESSING_SHARE : percent(job), now);

            if (allDone) {
                log.info("job_chunks_done id={} chunks={} -> merging", job.getId(), job.getTotalChunks());
                mergeService.mergeAsync(job.getId());
            }
            return null;
        });
    }

    /** A chunk failed twice: the whole job fails with a readable reason. */
    public synchronized void chunkFailed(ChunkTask task, String error) {
        withRetry(() -> {
            Job job = activeJob(task.getJobId());
            if (job == null) {
                return null;
            }
            JobChunk chunk = findChunk(task);
            if (chunk != null) {
                chunk.setStatus(ChunkStatus.FAILED);
                chunk.setFinishedAt(Instant.now());
                jobChunkRepository.save(chunk);
            }

            job.setStatus(JobStatus.FAILED);
            job.setErrorMessage("Chunk " + task.getChunkIndex() + " failed: " + error);
            job.setFinishedAt(Instant.now());
            job.setUpdatedAt(Instant.now());
            jobEventPublisher.publishJobChanged(jobRepository.save(job));
            progressTracker.clear(job.getId());
            mediaClient.deleteWorkdirQuietly(job.getId());
            log.warn("job_failed id={} reason={}", job.getId(), job.getErrorMessage());
            return null;
        });
    }

    // ------------------------------------------------------------------ helpers

    /** The job, or null when it is gone, finished, cancelled or already merging (late reports are ignored). */
    private Job activeJob(Integer jobId) {
        return jobRepository.findById(jobId)
                .filter(job -> !job.getStatus().isTerminal() && job.getStatus() != JobStatus.MERGING)
                .orElse(null);
    }

    private JobChunk findChunk(ChunkTask task) {
        return jobChunkRepository.findByJob_IdAndChunkIndex(task.getJobId(), task.getChunkIndex()).orElse(null);
    }

    private void seedTracker(Job job) {
        if (!progressTracker.isTracked(job.getId())) {
            progressTracker.seed(job.getId(), jobChunkRepository.findByJob_IdOrderByChunkIndexAsc(job.getId()));
        }
    }

    private void saveAndPublish(Job job, int progress, Instant now) {
        job.setProgress(progress);
        job.setUpdatedAt(now);
        jobEventPublisher.publishJobChanged(jobRepository.save(job));
    }

    private int percent(Job job) {
        long total = Math.max(1, job.getFrameCount());
        long done = progressTracker.totalFramesDone(job.getId());
        return (int) Math.min(PROCESSING_SHARE, done * PROCESSING_SHARE / total);
    }

    /** A cancel can save the job between our read and our write (optimistic locking). Read again and retry. */
    private <T> T withRetry(Supplier<T> action) {
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                return action.get();
            } catch (ObjectOptimisticLockingFailureException e) {
                // try again with fresh state
            }
        }
        log.warn("Gave up on a progress update after retries");
        return null;
    }
}
