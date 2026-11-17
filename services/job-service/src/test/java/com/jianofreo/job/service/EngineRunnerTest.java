package com.jianofreo.job.service;

import com.jianofreo.job.config.AppProperties;
import com.jianofreo.job.dto.engine.ChunkTask;
import com.jianofreo.job.dto.engine.EngineResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Runs a REAL child process through the same protocol as the Python engine, using a fake
 * app/run_chunk.py whose behaviour is picked by the task's "mode". Skipped if Python isn't on the PATH.
 */
class EngineRunnerTest {

    private static final String PYTHON = System.getenv().getOrDefault("TEST_PYTHON", "python");

    private static final String FAKE_ENGINE = """
            import json, sys, time
            task = json.load(sys.stdin)
            mode = task["mode"]
            if mode == "ok":
                for n in (1, 2, 3):
                    print(json.dumps({"event": "progress", "framesDone": n}), flush=True)
                print("a log line on stderr", file=sys.stderr, flush=True)
                print(json.dumps({"event": "done", "framesDone": 3, "framesWritten": 7, "outputPath": task["outputPath"]}), flush=True)
            elif mode == "error":
                print(json.dumps({"event": "error", "message": "boom"}), flush=True)
                sys.exit(1)
            elif mode == "crash":
                print("this is not json", flush=True)
                print("Traceback: kaboom", file=sys.stderr, flush=True)
                sys.exit(7)
            elif mode == "slow":
                print(json.dumps({"event": "progress", "framesDone": 1}), flush=True)
                time.sleep(60)
            """;

    @TempDir
    static Path engineDir;

    private EngineRunner runner;

    @BeforeAll
    static void writeFakeEngine() throws Exception {
        assumeTrue(pythonAvailable(), "python not on PATH");
        Files.createDirectories(engineDir.resolve("app"));
        Files.writeString(engineDir.resolve("app/__init__.py"), "");
        Files.writeString(engineDir.resolve("app/run_chunk.py"), FAKE_ENGINE);
    }

    private static boolean pythonAvailable() {
        try {
            return new ProcessBuilder(PYTHON, "--version").start().waitFor(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            return false;
        }
    }

    private EngineRunner runner() {
        AppProperties props = new AppProperties("http://unused", "/data", 2, "http://unused", "k", PYTHON, engineDir.toString(), 1, 0, 30, 1, 1, 5);
        runner = new EngineRunner(props, JsonMapper.builder().build());
        return runner;
    }

    @AfterEach
    void shutdown() {
        if (runner != null) {
            runner.shutdown();
        }
    }

    private static ChunkTask task(String mode) {
        return new ChunkTask(7, 0, "/in.mp4", 0, 3, false, 2, mode, "24/1", 64, 48, "/out/chunk_00000.mp4", null);
    }

    @Test
    void doneWithProgress() {
        List<Integer> progress = new CopyOnWriteArrayList<>();
        EngineResult result = runner().run(task("ok"), progress::add);
        assertThat(result.status()).isEqualTo(EngineResult.Status.DONE);
        assertThat(result.framesDone()).isEqualTo(3);
        assertThat(result.outputPath()).isEqualTo("/out/chunk_00000.mp4");
        assertThat(progress).containsExactly(1, 2, 3);
    }

    @Test
    void errorEventBecomesFailure() {
        EngineResult result = runner().run(task("error"), n -> { });
        assertThat(result.status()).isEqualTo(EngineResult.Status.FAILED);
        assertThat(result.error()).isEqualTo("boom");
    }

    @Test
    void crashReportsExitCodeAndLastStderrLine() {
        EngineResult result = runner().run(task("crash"), n -> { });
        assertThat(result.status()).isEqualTo(EngineResult.Status.FAILED);
        assertThat(result.error()).contains("code 7").contains("kaboom");
    }

    @Test
    void cancelStopsARunningEngine() throws Exception {
        EngineRunner engine = runner();
        CountDownLatch started = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<EngineResult> future = pool.submit(() -> engine.run(task("slow"), n -> started.countDown()));
            assertThat(started.await(20, TimeUnit.SECONDS)).isTrue();

            long t0 = System.nanoTime();
            engine.cancelJob(7);
            EngineResult result = future.get(15, TimeUnit.SECONDS); // would take 60 s if it weren't killed
            assertThat(result.status()).isNotEqualTo(EngineResult.Status.DONE);
            assertThat(TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - t0)).isLessThan(10);
        } finally {
            pool.shutdownNow();
        }
    }
}
