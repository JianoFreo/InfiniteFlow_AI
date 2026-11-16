package com.jianofreo.worker.service;

import com.jianofreo.worker.client.JobClient;
import com.jianofreo.worker.config.WorkerProperties;
import com.jianofreo.worker.dto.engine.EngineResult;
import com.jianofreo.worker.dto.message.ChunkTask;
import com.jianofreo.worker.messaging.ProgressPublisher;
import com.jianofreo.worker.service.ChunkService.Outcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.function.IntConsumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChunkServiceTest {

    private final EngineRunner engineRunner = mock(EngineRunner.class);
    private final ProgressPublisher publisher = mock(ProgressPublisher.class);
    private final JobClient jobClient = mock(JobClient.class);
    private final CancelRegistry cancelRegistry = new CancelRegistry();
    private final WorkerProperties props = new WorkerProperties("http://job-service", "worker-1", "python", ".", 0, 30, 10);
    private final ChunkService service = new ChunkService(engineRunner, publisher, cancelRegistry, jobClient, props);

    private final ChunkTask task = new ChunkTask(7, 3, "/data/in.mp4", 144, 48, false, 4, "flow", "24/1",
            1280, 720, "/tmp/infiniteflow-test-chunk_00003.mp4");

    @BeforeEach
    void jobIsActive() {
        when(jobClient.isJobActive(7)).thenReturn(true);
    }

    private void engineReturns(EngineResult result) {
        when(engineRunner.run(any(), any())).thenReturn(result);
    }

    @Test
    void skipsChunkOfCancelledJobWithoutRunningTheEngine() {
        cancelRegistry.add(7);
        assertThat(service.process(task, false)).isEqualTo(Outcome.ACK);
        verifyNoInteractions(engineRunner);
    }

    @Test
    void skipsChunkOfInactiveJob() {
        when(jobClient.isJobActive(7)).thenReturn(false);
        assertThat(service.process(task, false)).isEqualTo(Outcome.ACK);
        verifyNoInteractions(engineRunner);
    }

    @Test
    void reportsDoneThenAcks() {
        engineReturns(EngineResult.done(48, task.getOutputPath()));
        assertThat(service.process(task, false)).isEqualTo(Outcome.ACK);
        verify(publisher).done(task, 48, task.getOutputPath());
        verify(publisher, never()).failed(any(), any());
    }

    @Test
    void forwardsEngineProgress() {
        when(engineRunner.run(any(), any())).thenAnswer(invocation -> {
            IntConsumer onProgress = invocation.getArgument(1);
            onProgress.accept(10);
            onProgress.accept(20);
            return EngineResult.done(48, task.getOutputPath());
        });
        service.process(task, false);
        verify(publisher).progress(task, 0);
        verify(publisher).progress(task, 10);
        verify(publisher).progress(task, 20);
    }

    @Test
    void firstFailureIsRetried() {
        engineReturns(EngineResult.failed("boom"));
        assertThat(service.process(task, false)).isEqualTo(Outcome.REQUEUE);
        verify(publisher, never()).failed(any(), any());
    }

    @Test
    void secondFailureIsReportedAndDeadLettered() {
        engineReturns(EngineResult.failed("boom"));
        assertThat(service.process(task, true)).isEqualTo(Outcome.REJECT);
        verify(publisher).failed(task, "boom");
    }

    @Test
    void failureCausedByOurOwnCancelIsNotAFailure() {
        when(engineRunner.run(any(), any())).thenAnswer(invocation -> {
            cancelRegistry.add(7); // the cancel arrived while the engine was running, and we killed it
            return EngineResult.failed("engine exited with code 143");
        });
        assertThat(service.process(task, true)).isEqualTo(Outcome.ACK);
        verify(publisher, never()).failed(any(), any());
    }

    @Test
    void cancelledEngineIsAcked() {
        engineReturns(EngineResult.cancelled());
        assertThat(service.process(task, false)).isEqualTo(Outcome.ACK);
        verify(publisher, never()).done(any(), anyInt(), any());
    }
}
