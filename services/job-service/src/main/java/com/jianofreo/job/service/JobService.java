package com.jianofreo.job.service;

import com.jianofreo.job.client.MediaClient;
import com.jianofreo.job.config.AppProperties;
import com.jianofreo.job.dto.job.ChunkResponse;
import com.jianofreo.job.dto.job.JobRequest;
import com.jianofreo.job.dto.job.JobResponse;
import com.jianofreo.job.dto.media.MediaResponse;
import com.jianofreo.job.dto.message.ChunkTask;
import com.jianofreo.job.entity.ChunkStatus;
import com.jianofreo.job.entity.Job;
import com.jianofreo.job.entity.JobChunk;
import com.jianofreo.job.entity.JobStatus;
import com.jianofreo.job.exception.ApiException;
import com.jianofreo.job.messaging.MessagePublisher;
import com.jianofreo.job.repository.JobChunkRepository;
import com.jianofreo.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;

import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobService {

    private static final List<JobStatus> ACTIVE = List.of(JobStatus.QUEUED, JobStatus.PROCESSING, JobStatus.MERGING);

    private final JobRepository jobRepository;
    private final JobChunkRepository jobChunkRepository;
    private final MediaClient mediaClient;
    private final MessagePublisher messagePublisher;
    private final ProgressTracker progressTracker;
    private final AppProperties props;

    /**
     * 1. ask media-service what the source video is (fps, frames, size)
     * 2. plan frame-range chunks
     * 3. save job + chunks
     * 4. put one message per chunk on interp.chunks: every idle engine replica grabs one
     */
    public JobResponse createJob(JobRequest request) {
        MediaResponse media;
        try {
            media = mediaClient.getMedia(request.getSourceMediaId());
        } catch (ResourceAccessException e) {
            throw MediaClient.unavailable(e);
        }

        String mode = request.getMode() == null ? "flow" : request.getMode();
        int framesPerChunk = ChunkPlanner.framesPerChunk(media.getFpsValue(), props.chunkSeconds());
        List<ChunkPlanner.ChunkPlan> plans = ChunkPlanner.plan(media.getFrameCount(), framesPerChunk);

        Instant now = Instant.now();
        Job job = new Job(null, null, JobStatus.QUEUED, mode, request.getFactor(), 0, null,
                media.getId(), null,
                media.getFileName(), media.getPath(), media.getFps(), media.getFpsValue(),
                media.getWidth(), media.getHeight(), media.getFrameCount(), media.getDurationMs(),
                media.getHasAudio(), media.getSizeBytes(), null,
                plans.size(), 0, now, now, null, null);
        Job saved = jobRepository.save(job);

        List<JobChunk> chunks = new ArrayList<>();
        for (ChunkPlanner.ChunkPlan plan : plans) {
            chunks.add(new JobChunk(null, saved, plan.index(), plan.startFrame(), plan.frameCount(),
                    ChunkStatus.PENDING, null, null, null, null));
        }
        jobChunkRepository.saveAll(chunks);
        progressTracker.seed(saved.getId(), chunks);

        for (ChunkPlanner.ChunkPlan plan : plans) {
            messagePublisher.publishChunk(new ChunkTask(saved.getId(), plan.index(), media.getPath(),
                    plan.startFrame(), plan.frameCount(), plan.last(), saved.getFactor(), mode,
                    media.getFps(), media.getWidth(), media.getHeight(), chunkOutputPath(saved.getId(), plan.index())));
        }
        messagePublisher.publishJobChanged(saved);

        log.info("job_created id={} file={} frames={} factor={} mode={} chunks={}x{}f",
                saved.getId(), saved.getFileName(), saved.getFrameCount(), saved.getFactor(), mode,
                plans.size(), framesPerChunk);
        return JobMapper.toResponse(saved);
    }

    public List<JobResponse> listJobs(int limit, boolean activeOnly) {
        PageRequest page = PageRequest.of(0, Math.max(1, Math.min(200, limit)));
        List<Job> jobs = activeOnly
                ? jobRepository.findByStatusInOrderByIdDesc(ACTIVE, page)
                : jobRepository.findAllByOrderByIdDesc(page);
        return jobs.stream().map(JobMapper::toResponse).toList();
    }

    public JobResponse getJob(Integer id) {
        return JobMapper.toResponse(findJob(id));
    }

    public List<ChunkResponse> getChunks(Integer jobId) {
        findJob(jobId);
        return jobChunkRepository.findByJob_IdOrderByChunkIndexAsc(jobId).stream()
                .map(chunk -> JobMapper.toResponse(chunk, chunk.getStatus() == ChunkStatus.COMPLETED
                        ? chunk.getFrameCount()
                        : progressTracker.framesDone(jobId, chunk.getChunkIndex())))
                .toList();
    }

    public JobResponse cancelJob(Integer id) {
        for (int attempt = 0; ; attempt++) {
            Job job = findJob(id);
            if (job.getStatus().isTerminal()) {
                return JobMapper.toResponse(job);
            }
            job.setStatus(JobStatus.CANCELLED);
            job.setErrorMessage("Cancelled by user");
            job.setFinishedAt(Instant.now());
            job.setUpdatedAt(Instant.now());
            try {
                Job saved = jobRepository.save(job);
                messagePublisher.publishCancel(id);
                messagePublisher.publishJobChanged(saved);
                progressTracker.clear(id);
                mediaClient.deleteWorkdirQuietly(id);
                log.info("job_cancelled id={}", id);
                return JobMapper.toResponse(saved);
            } catch (ObjectOptimisticLockingFailureException e) {
                if (attempt >= 3) throw e; // the progress listener saved at the same moment: reload and retry
            }
        }
    }

    public void deleteJob(Integer id) {
        Job job = findJob(id);
        if (!job.getStatus().isTerminal()) {
            messagePublisher.publishCancel(id);
        }
        mediaClient.deleteMediaQuietly(job.getSourceMediaId());
        mediaClient.deleteMediaQuietly(job.getOutputMediaId());
        mediaClient.deleteWorkdirQuietly(id);
        jobChunkRepository.deleteByJob_Id(id);
        jobRepository.deleteById(id);
        progressTracker.clear(id);
        messagePublisher.publishJobDeleted(id);
        log.info("job_deleted id={}", id);
    }

    Job findJob(Integer id) {
        return jobRepository.findById(id).orElseThrow(() -> ApiException.notFound("Job " + id + " not found"));
    }

    private String chunkOutputPath(Integer jobId, int chunkIndex) {
        return Path.of(props.storageRoot(), "jobs", String.valueOf(jobId), String.format("chunk_%05d.mp4", chunkIndex))
                .toString().replace('\\', '/');
    }
}
