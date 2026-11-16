package com.jianofreo.worker.service;

import com.jianofreo.worker.config.WorkerProperties;
import com.jianofreo.worker.dto.engine.EngineEvent;
import com.jianofreo.worker.dto.engine.EngineResult;
import com.jianofreo.worker.dto.message.ChunkTask;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.IntConsumer;

/**
 * Runs the Python engine on one chunk: {@code python -m app.run_chunk} as a child process.
 *
 *   stdin  ← the chunk task as JSON
 *   stdout → one JSON event per line: progress / done / cancelled / error
 *   stderr → copied into this service's log
 *
 * The Python side does computation only. Everything else (timeouts, cancellation, what a failure means)
 * is decided here in Java.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EngineRunner {

    private static final int STDERR_TAIL_LINES = 20;

    private final WorkerProperties props;
    private final ObjectMapper objectMapper;

    /** Engine processes currently running, by job id, so a cancel can find them. */
    private final Map<Integer, Set<Process>> running = new ConcurrentHashMap<>();

    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "engine-watchdog");
        thread.setDaemon(true);
        return thread;
    });

    /** Blocks until the engine exits. onProgress receives "source frames finished" counts. */
    public EngineResult run(ChunkTask task, IntConsumer onProgress) {
        Process process;
        try {
            process = new ProcessBuilder(props.pythonCommand(), "-m", "app.run_chunk")
                    .directory(new File(props.engineDir()))
                    .start();
        } catch (IOException e) {
            return EngineResult.failed("could not start the engine: " + e.getMessage());
        }

        int jobId = task.getJobId();
        running.compute(jobId, (id, processes) -> {
            Set<Process> set = processes == null ? ConcurrentHashMap.newKeySet() : processes;
            set.add(process);
            return set;
        });
        Deque<String> stderrTail = new ArrayDeque<>();
        Thread stderrPump = pumpStderr(process, task, stderrTail);
        AtomicBoolean timedOut = new AtomicBoolean();
        ScheduledFuture<?> timeout = watchdog.schedule(() -> {
            timedOut.set(true);
            stop(process);
        }, props.chunkTimeoutMinutes(), TimeUnit.MINUTES);

        EngineEvent last = null;
        int exitCode;
        try {
            try (Writer stdin = process.outputWriter(StandardCharsets.UTF_8)) {
                stdin.write(objectMapper.writeValueAsString(task));
            } catch (IOException e) {
                // The process died before reading its input; its exit code and stderr tell why.
                log.warn("engine_stdin_closed job={} chunk={} error={}", jobId, task.getChunkIndex(), e.getMessage());
            }
            try (BufferedReader stdout = process.inputReader(StandardCharsets.UTF_8)) {
                String line;
                while ((line = stdout.readLine()) != null) {
                    EngineEvent event = parse(line, task);
                    if (event == null) {
                        continue;
                    }
                    if ("progress".equals(event.getEvent())) {
                        if (event.getFramesDone() != null) {
                            onProgress.accept(event.getFramesDone());
                        }
                    } else {
                        last = event;
                    }
                }
            }
            exitCode = process.waitFor();
            stderrPump.join(TimeUnit.SECONDS.toMillis(2));
        } catch (IOException e) {
            stop(process);
            return EngineResult.failed("lost contact with the engine: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            stop(process);
            return EngineResult.failed("worker interrupted");
        } finally {
            timeout.cancel(false);
            running.computeIfPresent(jobId, (id, processes) -> {
                processes.remove(process);
                return processes.isEmpty() ? null : processes; // atomic: no lost registration
            });
        }

        if (last != null && "done".equals(last.getEvent()) && exitCode == 0) {
            return EngineResult.done(last.getFramesDone() == null ? 0 : last.getFramesDone(), last.getOutputPath());
        }
        if (last != null && "cancelled".equals(last.getEvent())) {
            return EngineResult.cancelled();
        }
        if (timedOut.get()) {
            return EngineResult.failed("timed out after " + props.chunkTimeoutMinutes() + " min");
        }
        if (last != null && "error".equals(last.getEvent())) {
            return EngineResult.failed(last.getMessage());
        }
        String lastLog;
        synchronized (stderrTail) {
            lastLog = stderrTail.isEmpty() ? "" : ": " + stderrTail.peekLast();
        }
        return EngineResult.failed("engine exited with code " + exitCode + lastLog);
    }

    /** Stops every engine process working on this job (called when the job is cancelled). */
    public void cancelJob(int jobId) {
        Set<Process> processes = running.get(jobId);
        if (processes != null && !processes.isEmpty()) {
            log.info("engine_stopping job={} processes={}", jobId, processes.size());
            processes.forEach(this::stop);
        }
    }

    /** SIGTERM first (the engine deletes its half-written file and exits), SIGKILL if it doesn't. */
    private void stop(Process process) {
        if (!process.isAlive()) {
            return;
        }
        process.destroy();
        watchdog.schedule(() -> forceKill(process), props.stopGraceSeconds(), TimeUnit.SECONDS);
    }

    private static void forceKill(Process process) {
        if (process.isAlive()) {
            process.descendants().forEach(ProcessHandle::destroyForcibly); // ffmpeg children
            process.destroyForcibly();
        }
    }

    @PreDestroy
    public void shutdown() {
        // The unacked chunks go back to RabbitMQ when this replica disconnects; another replica redoes them.
        running.values().forEach(processes -> processes.forEach(EngineRunner::forceKill));
        watchdog.shutdownNow();
    }

    private EngineEvent parse(String line, ChunkTask task) {
        try {
            return objectMapper.readValue(line, EngineEvent.class);
        } catch (JacksonException e) {
            log.warn("engine_stdout_not_json job={} chunk={} line={}", task.getJobId(), task.getChunkIndex(), line);
            return null;
        }
    }

    private Thread pumpStderr(Process process, ChunkTask task, Deque<String> tail) {
        Thread thread = new Thread(() -> {
            try (BufferedReader stderr = process.errorReader(StandardCharsets.UTF_8)) {
                String line;
                while ((line = stderr.readLine()) != null) {
                    log.info("engine job={} chunk={} | {}", task.getJobId(), task.getChunkIndex(), line);
                    synchronized (tail) {
                        tail.addLast(line);
                        if (tail.size() > STDERR_TAIL_LINES) {
                            tail.removeFirst();
                        }
                    }
                }
            } catch (IOException ignored) {
                // process ended
            }
        }, "engine-stderr-" + task.getJobId() + "-" + task.getChunkIndex());
        thread.setDaemon(true);
        thread.start();
        return thread;
    }
}
