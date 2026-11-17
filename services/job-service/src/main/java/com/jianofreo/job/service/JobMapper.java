package com.jianofreo.job.service;

import com.jianofreo.job.dto.job.ChunkResponse;
import com.jianofreo.job.dto.job.JobResponse;
import com.jianofreo.job.entity.Job;
import com.jianofreo.job.entity.JobChunk;

/** Entity → response DTO, built by hand (no mapper library), as in simulab. Entities never leave the service. */
final class JobMapper {

    private JobMapper() {
    }

    static JobResponse toResponse(Job job) {
        Double outputFps = job.getFpsValue() == null ? null : job.getFpsValue() * job.getFactor();
        Integer outputFrames = job.getFrameCount() == null ? null
                : ChunkPlanner.outputFrameCount(job.getFrameCount(), job.getFactor());
        return new JobResponse(
                job.getId(), job.getStatus().name(), job.getMode(), job.getFactor(), job.getProgress(),
                job.getErrorMessage(), job.getSourceMediaId(), job.getOutputMediaId(),
                job.getFileName(), job.getFps(), job.getFpsValue(), outputFps,
                job.getWidth(), job.getHeight(), job.getFrameCount(), outputFrames,
                job.getDurationMs(), job.getHasAudio(), job.getSourceSizeBytes(), job.getOutputSizeBytes(),
                job.getTotalChunks(), job.getCompletedChunks(),
                job.getCreatedAt(), job.getUpdatedAt(), job.getStartedAt(), job.getFinishedAt(), job.getPreprocess());
    }

    static ChunkResponse toResponse(JobChunk chunk, int framesDone) {
        return new ChunkResponse(chunk.getChunkIndex(), chunk.getStartFrame(), chunk.getFrameCount(),
                framesDone, chunk.getStatus().name(), chunk.getWorker(), chunk.getStartedAt(), chunk.getFinishedAt());
    }
}
