package com.jianofreo.worker.service;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Job ids cancelled recently, so chunks of those jobs still waiting in the queue are skipped. */
@Component
public class CancelRegistry {

    private static final Duration TTL = Duration.ofHours(1);

    private final Map<Integer, Instant> cancelled = new ConcurrentHashMap<>();

    public void add(int jobId) {
        Instant now = Instant.now();
        cancelled.put(jobId, now);
        cancelled.values().removeIf(at -> at.isBefore(now.minus(TTL)));
    }

    public boolean isCancelled(int jobId) {
        return cancelled.containsKey(jobId);
    }
}
