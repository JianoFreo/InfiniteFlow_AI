package com.jianofreo.job.service;

import com.jianofreo.job.client.MediaClient;
import com.jianofreo.job.dto.media.MediaResponse;
import com.jianofreo.job.dto.media.MergeRequest;
import com.jianofreo.job.entity.Job;
import com.jianofreo.job.entity.JobChunk;
import com.jianofreo.job.entity.JobStatus;
import com.jianofreo.job.repository.JobChunkRepository;
import com.jianofreo.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Last step: ask media-service to glue the chunks together. Runs on its own thread so the engines can keep reporting. */
@Slf4j
@Service
@RequiredArgsConstructor
public class MergeService {

    private final JobRepository jobRepository;
    private final JobChunkRepository jobChunkRepository;
    private final MediaClient mediaClient;
    private final JobEventPublisher jobEventPublisher;
    private final ProgressTracker progressTracker;

    @Async
    public void mergeAsync(Integer jobId) {
        Job job = jobRepository.findById(jobId).orElse(null);
        if (job == null || job.getStatus() != JobStatus.MERGING) {
            return;
        }

        List<String> chunkPaths = jobChunkRepository.findByJob_IdOrderByChunkIndexAsc(jobId).stream()
                .map(JobChunk::getOutputPath)
                .filter(Objects::nonNull)
                .toList();

        try {
            MediaResponse output = mediaClient.merge(
                    new MergeRequest(jobId, job.getSourceMediaId(), chunkPaths, outputName(job)));

            Job fresh = jobRepository.findById(jobId).orElse(null);
            if (fresh == null || fresh.getStatus() != JobStatus.MERGING) {
                mediaClient.deleteMediaQuietly(output.getId()); // deleted or cancelled while merging
                return;
            }
            fresh.setOutputMediaId(output.getId());
            fresh.setOutputSizeBytes(output.getSizeBytes());
            fresh.setStatus(JobStatus.COMPLETED);
            fresh.setProgress(100);
            fresh.setFinishedAt(Instant.now());
            fresh.setUpdatedAt(Instant.now());
            Job saved = jobRepository.save(fresh);
            jobEventPublisher.publishJobChanged(saved);
            long tookMs = saved.getFinishedAt().toEpochMilli() - saved.getCreatedAt().toEpochMilli();
            log.info("job_completed id={} output={} total={}ms", jobId, output.getId(), tookMs);
        } catch (RuntimeException e) {
            log.error("job_merge_failed id={}", jobId, e);
            jobRepository.findById(jobId).ifPresent(fresh -> {
                fresh.setStatus(JobStatus.FAILED);
                fresh.setErrorMessage("Merge failed: " + e.getMessage());
                fresh.setFinishedAt(Instant.now());
                fresh.setUpdatedAt(Instant.now());
                jobEventPublisher.publishJobChanged(jobRepository.save(fresh));
            });
        } finally {
            progressTracker.clear(jobId);
        }
    }

    private static String outputName(Job job) {
        String base = job.getFileName() == null ? "video" : job.getFileName().replaceFirst("\\.[^.]+$", "");
        return base + "_" + job.getFactor() + "x.mp4";
    }
}
