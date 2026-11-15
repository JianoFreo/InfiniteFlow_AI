package com.jianofreo.job.service;

import java.util.ArrayList;
import java.util.List;

/**
 * Splits a video into frame ranges that engine replicas can process in parallel.
 * Pure math, no Spring, so it is easy to unit test.
 */
public final class ChunkPlanner {

    /** Below this a chunk spends more time starting ffmpeg than interpolating. */
    static final int MIN_CHUNK_FRAMES = 24;

    public record ChunkPlan(int index, int startFrame, int frameCount, boolean last) {
    }

    private ChunkPlanner() {
    }

    public static int framesPerChunk(double fps, double chunkSeconds) {
        return Math.max(MIN_CHUNK_FRAMES, (int) Math.round(fps * chunkSeconds));
    }

    public static List<ChunkPlan> plan(int totalFrames, int framesPerChunk) {
        if (totalFrames < 2) {
            throw new IllegalArgumentException("Need at least two frames");
        }
        int size = Math.max(1, framesPerChunk);
        int count = (totalFrames + size - 1) / size;
        // Don't leave a tiny last chunk (e.g. 3 frames): fold it into the previous one.
        if (count > 1 && totalFrames - (count - 1) * size < size / 4) {
            count--;
        }

        List<ChunkPlan> plans = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            int start = i * size;
            boolean last = i == count - 1;
            int frames = last ? totalFrames - start : size;
            plans.add(new ChunkPlan(i, start, frames, last));
        }
        return plans;
    }

    /** Frames in the final video: every source frame plus (factor - 1) new frames between each pair. */
    public static int outputFrameCount(int sourceFrames, int factor) {
        return (sourceFrames - 1) * factor + 1;
    }
}
