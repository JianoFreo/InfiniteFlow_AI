package com.jianofreo.job.service;

import com.jianofreo.job.config.AppProperties;
import com.jianofreo.job.dto.engine.ChunkTask;
import com.jianofreo.job.dto.engine.EngineResult;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** What happens to one chunk: the engine and the progress service are mocked, so no Python and no database. */
class JobRunnerTest {

    private final EngineRunner engineRunner = mock(EngineRunner.class);
    private final JobProgressService progress = mock(JobProgressService.class);
    private final AppProperties props =
            new AppProperties("http://media", "/data", 2, "http://bff", "k", "python", ".", 1, 0, 30, 1);

    private final ChunkTask task = new ChunkTask(7, 3, "/data/in.mp4", 144, 48, false, 4, "flow", "24/1",
            1280, 720, "/tmp/infiniteflow-test-chunk_00003.mp4", null);

    /** Runs the task on a real pool thread (like production) and waits until it is finished. */
    private void runAndWait(JobRunner runner, ExecutorService pool) throws Exception {
        runner.start(List.of(task));
        pool.shutdown();
        pool.awaitTermination(10, TimeUnit.SECONDS);
    }

    private JobRunner runner(ExecutorService pool) {
        return new JobRunner(pool, engineRunner, progress, props);
    }

    @Test
    void reportsDoneWhenTheEngineFinishes() throws Exception {
        when(progress.chunkStarted(eq(task), anyString())).thenReturn(true);
        when(engineRunner.run(any(), any())).thenReturn(EngineResult.done(48, task.getOutputPath()));
        ExecutorService pool = Executors.newSingleThreadExecutor();

        runAndWait(runner(pool), pool);

        verify(progress).chunkDone(task, 48, task.getOutputPath());
        verify(progress, never()).chunkFailed(any(), any());
    }

    @Test
    void skipsAChunkWhoseJobIsNoLongerActive() throws Exception {
        when(progress.chunkStarted(eq(task), anyString())).thenReturn(false);
        ExecutorService pool = Executors.newSingleThreadExecutor();

        runAndWait(runner(pool), pool);

        verifyNoInteractions(engineRunner);
    }

    @Test
    void skipsAChunkOfACancelledJob() throws Exception {
        ExecutorService pool = Executors.newSingleThreadExecutor();
        JobRunner runner = runner(pool);
        runner.cancel(7);

        runAndWait(runner, pool);

        verify(engineRunner).cancelJob(7);
        verify(engineRunner, never()).run(any(), any());
        verify(progress, never()).chunkStarted(any(), anyString());
    }

    @Test
    void triesAFailingChunkTwiceThenFailsTheJob() throws Exception {
        when(progress.chunkStarted(eq(task), anyString())).thenReturn(true);
        when(engineRunner.run(any(), any())).thenReturn(EngineResult.failed("boom"));
        ExecutorService pool = Executors.newSingleThreadExecutor();

        runAndWait(runner(pool), pool);

        verify(engineRunner, times(2)).run(any(), any());
        verify(progress).chunkFailed(task, "boom");
        verify(progress, never()).chunkDone(any(), anyInt(), any());
        verify(engineRunner).cancelJob(7); // the other chunks of a failed job are stopped
    }

    @Test
    void aRetryThatWorksIsNotAFailure() throws Exception {
        when(progress.chunkStarted(eq(task), anyString())).thenReturn(true);
        when(engineRunner.run(any(), any()))
                .thenReturn(EngineResult.failed("boom"))
                .thenReturn(EngineResult.done(48, task.getOutputPath()));
        ExecutorService pool = Executors.newSingleThreadExecutor();

        runAndWait(runner(pool), pool);

        verify(progress).chunkDone(task, 48, task.getOutputPath());
        verify(progress, never()).chunkFailed(any(), any());
    }
}
