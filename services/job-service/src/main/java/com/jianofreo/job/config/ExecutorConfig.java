package com.jianofreo.job.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * The two thread pools of this service.
 *
 *  chunkExecutor  runs the Python engine. N threads = N chunks processed at the same time. When more chunks
 *                 are waiting than there are threads, the extra ones wait inside the pool (that is the whole
 *                 "queue": a plain in-memory list, nothing to install or operate).
 *  eventExecutor  sends job changes to the BFF. ONE thread, so events leave in the order they happened.
 */
@Configuration
public class ExecutorConfig {

    @Bean(destroyMethod = "shutdownNow")
    public ExecutorService chunkExecutor(AppProperties props) {
        AtomicInteger counter = new AtomicInteger();
        // Thread names ("engine-1", "engine-2"...) are shown in the UI chunk grid as the worker of each chunk
        return Executors.newFixedThreadPool(Math.max(1, props.engineThreads()), runnable -> {
            Thread thread = new Thread(runnable, "engine-" + counter.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }

    @Bean(destroyMethod = "shutdown")
    public ExecutorService eventExecutor() {
        return Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "bff-events");
            thread.setDaemon(true);
            return thread;
        });
    }
}
