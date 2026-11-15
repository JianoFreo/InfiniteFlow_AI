package com.jianofreo.job.service;

import com.jianofreo.job.entity.ChunkStatus;
import com.jianofreo.job.entity.JobChunk;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Live per-chunk progress kept in memory. The engines report several times a second; writing every
 * report to Postgres was one of the old bottlenecks. The DB is only written about twice a second per job.
 * After a restart, seed() rebuilds what it can from the DB (finished chunks).
 */
@Component
public class ProgressTracker {

    private static final long PERSIST_INTERVAL_MS = 500;

    private final Map<Integer, Map<Integer, Integer>> framesDone = new ConcurrentHashMap<>();
    private final Map<Integer, Long> lastPersistAt = new ConcurrentHashMap<>();

    public void seed(Integer jobId, List<JobChunk> chunks) {
        framesDone.computeIfAbsent(jobId, id -> {
            Map<Integer, Integer> perChunk = new ConcurrentHashMap<>();
            for (JobChunk chunk : chunks) {
                if (chunk.getStatus() == ChunkStatus.COMPLETED) {
                    perChunk.put(chunk.getChunkIndex(), chunk.getFrameCount());
                }
            }
            return perChunk;
        });
    }

    public boolean isTracked(Integer jobId) {
        return framesDone.containsKey(jobId);
    }

    public void update(Integer jobId, Integer chunkIndex, int frames) {
        framesDone.computeIfAbsent(jobId, id -> new ConcurrentHashMap<>()).put(chunkIndex, frames);
    }

    public int framesDone(Integer jobId, Integer chunkIndex) {
        return framesDone.getOrDefault(jobId, Map.of()).getOrDefault(chunkIndex, 0);
    }

    public long totalFramesDone(Integer jobId) {
        return framesDone.getOrDefault(jobId, Map.of()).values().stream().mapToLong(Integer::longValue).sum();
    }

    /** True at most once per interval per job. */
    public boolean shouldPersist(Integer jobId) {
        long now = System.currentTimeMillis();
        Long last = lastPersistAt.get(jobId);
        if (last != null && now - last < PERSIST_INTERVAL_MS) {
            return false;
        }
        lastPersistAt.put(jobId, now);
        return true;
    }

    public void clear(Integer jobId) {
        framesDone.remove(jobId);
        lastPersistAt.remove(jobId);
    }
}
