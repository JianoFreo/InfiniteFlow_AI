package com.jianofreo.job.service;

import com.jianofreo.job.client.MediaClient;
import com.jianofreo.job.dto.message.ProgressMessage;
import com.jianofreo.job.entity.ChunkStatus;
import com.jianofreo.job.entity.Job;
import com.jianofreo.job.entity.JobChunk;
import com.jianofreo.job.entity.JobStatus;
import com.jianofreo.job.messaging.MessagePublisher;
import com.jianofreo.job.repository.JobChunkRepository;
import com.jianofreo.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Turns the engines' chunk-level reports into job-level state.
 * Called from a single listener thread, so two reports for the same job are never handled at once.
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
    private final MessagePublisher messagePublisher;
    private final MergeService mergeService;
    private final MediaClient mediaClient;

    public void handle(ProgressMessage message) {
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                handleOnce(message);
                return;
            } catch (ObjectOptimisticLockingFailureException e) {
                // A cancel saved the job between our read and our write. Retry with fresh state.
            }
        }
        log.warn("Gave up on progress message after retries: {}", message);
    }

    private void handleOnce(ProgressMessage message) {
        Job job = jobRepository.findById(message.getJobId()).orElse(null);
        if (job == null || job.getStatus().isTerminal() || job.getStatus() == JobStatus.MERGING) {
            return; // deleted, cancelled, failed, or late messages after the last chunk
        }
        JobChunk chunk = jobChunkRepository.findByJob_IdAndChunkIndex(job.getId(), message.getChunkIndex()).orElse(null);
        if (chunk == null) {
            return;
        }

        if (!progressTracker.isTracked(job.getId())) {
            progressTracker.seed(job.getId(), jobChunkRepository.findByJob_IdOrderByChunkIndexAsc(job.getId()));
        }

        boolean mustSave = false;
        Instant now = Instant.now();
        if (job.getStatus() == JobStatus.QUEUED) {
            job.setStatus(JobStatus.PROCESSING);
            job.setStartedAt(now);
            mustSave = true;
        }

        switch (message.getStatus()) {
            case "PROGRESS" -> {
                if (chunk.getStatus() == ChunkStatus.COMPLETED) {
                    return; // late tick from a redelivered copy: don't move the bar backwards
                }
                progressTracker.update(job.getId(), chunk.getChunkIndex(),
                        Math.min(nz(message.getFramesDone()), chunk.getFrameCount()));
                boolean newWorker = message.getWorker() != null && !message.getWorker().equals(chunk.getWorker());
                if (chunk.getStatus() == ChunkStatus.PENDING || newWorker) {
                    // first tick, or another replica took over after a crash (RabbitMQ redelivery)
                    chunk.setStatus(ChunkStatus.PROCESSING);
                    chunk.setWorker(message.getWorker());
                    chunk.setStartedAt(now);
                    jobChunkRepository.save(chunk);
                    mustSave = true; // the UI chunk grid shows which replica took it
                }
            }
            case "DONE" -> {
                if (chunk.getStatus() == ChunkStatus.COMPLETED) {
                    return; // duplicate after a redelivery
                }
                chunk.setStatus(ChunkStatus.COMPLETED);
                chunk.setOutputPath(message.getOutputPath());
                chunk.setWorker(message.getWorker());
                if (chunk.getStartedAt() == null) chunk.setStartedAt(now);
                chunk.setFinishedAt(now);
                jobChunkRepository.save(chunk);
                progressTracker.update(job.getId(), chunk.getChunkIndex(), chunk.getFrameCount());
                job.setCompletedChunks(jobChunkRepository.countByJob_IdAndStatus(job.getId(), ChunkStatus.COMPLETED));
                mustSave = true;
            }
            case "FAILED" -> {
                chunk.setStatus(ChunkStatus.FAILED);
                chunk.setFinishedAt(now);
                jobChunkRepository.save(chunk);
                failJob(job, "Chunk " + chunk.getChunkIndex() + " failed: " + message.getError());
                return;
            }
            default -> {
                log.warn("Unknown progress status {}", message.getStatus());
                return;
            }
        }

        boolean allDone = job.getCompletedChunks().equals(job.getTotalChunks());
        int progress = allDone ? PROCESSING_SHARE : percent(job);
        if (allDone) {
            job.setStatus(JobStatus.MERGING);
        }

        boolean progressMoved = progress != job.getProgress();
        if (mustSave || allDone || (progressMoved && progressTracker.shouldPersist(job.getId()))) {
            job.setProgress(progress);
            job.setUpdatedAt(now);
            Job saved = jobRepository.save(job);
            messagePublisher.publishJobChanged(saved);
        }

        if (allDone) {
            log.info("job_chunks_done id={} chunks={} → merging", job.getId(), job.getTotalChunks());
            mergeService.mergeAsync(job.getId());
        }
    }

    private void failJob(Job job, String reason) {
        job.setStatus(JobStatus.FAILED);
        job.setErrorMessage(reason);
        job.setFinishedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        Job saved = jobRepository.save(job);
        messagePublisher.publishCancel(job.getId()); // stop the other chunks of this job
        messagePublisher.publishJobChanged(saved);
        progressTracker.clear(job.getId());
        mediaClient.deleteWorkdirQuietly(job.getId());
        log.warn("job_failed id={} reason={}", job.getId(), reason);
    }

    private int percent(Job job) {
        long total = Math.max(1, job.getFrameCount());
        long done = progressTracker.totalFramesDone(job.getId());
        return (int) Math.min(PROCESSING_SHARE, done * PROCESSING_SHARE / total);
    }

    private static int nz(Integer value) {
        return value == null ? 0 : value;
    }
}
