package com.jianofreo.job.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ChunkPlannerTest {

    @Test
    void chunksCoverEveryFrameExactlyOnce() {
        for (int total : new int[]{2, 23, 24, 60, 61, 300, 301, 1799, 12345}) {
            List<ChunkPlanner.ChunkPlan> plans = ChunkPlanner.plan(total, 60);
            int next = 0;
            for (ChunkPlanner.ChunkPlan plan : plans) {
                assertEquals(next, plan.startFrame(), "gap or overlap for total=" + total);
                assertTrue(plan.frameCount() > 0);
                next += plan.frameCount();
            }
            assertEquals(total, next, "frames lost for total=" + total);
            assertTrue(plans.get(plans.size() - 1).last());
            assertEquals(1, plans.stream().filter(ChunkPlanner.ChunkPlan::last).count());
        }
    }

    @Test
    void tinyTailIsFoldedIntoPreviousChunk() {
        List<ChunkPlanner.ChunkPlan> plans = ChunkPlanner.plan(305, 60);
        assertEquals(5, plans.size());
        assertEquals(65, plans.get(4).frameCount());
    }

    @Test
    void framesPerChunkFollowsFpsWithAFloor() {
        assertEquals(60, ChunkPlanner.framesPerChunk(30, 2));
        assertEquals(120, ChunkPlanner.framesPerChunk(59.94, 2));
        assertEquals(ChunkPlanner.MIN_CHUNK_FRAMES, ChunkPlanner.framesPerChunk(5, 2));
    }

    @Test
    void outputFrameCountAddsFactorMinusOneBetweenEachPair() {
        assertEquals(1197, ChunkPlanner.outputFrameCount(300, 4));
        assertEquals(3, ChunkPlanner.outputFrameCount(2, 2));
    }

    @Test
    void rejectsSingleFrameVideo() {
        assertThrows(IllegalArgumentException.class, () -> ChunkPlanner.plan(1, 60));
    }
}
