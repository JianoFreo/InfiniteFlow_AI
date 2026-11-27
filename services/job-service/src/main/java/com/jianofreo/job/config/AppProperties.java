package com.jianofreo.job.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Everything in application.properties that starts with "app.".
 *
 * @param mediaServiceUrl       base URL of media-service, e.g. http://media-service:8082
 * @param storageRoot           the shared volume root; chunk outputs go to {storageRoot}/jobs/{jobId}/
 * @param chunkSeconds          how much video one engine run covers. Smaller = more parallelism, more overhead.
 * @param bffEventsUrl          where job changes are pushed so the BFF can show them live
 * @param internalKey           shared secret sent with those pushes (the BFF rejects requests without it)
 * @param pythonCommand         the Python interpreter that runs the engine
 * @param engineDir             directory containing the engine's "app" package (the child process working dir)
 * @param engineThreads         how many chunks are processed at the same time on this machine
 * @param progressIntervalMs    minimum time between two progress reports for one chunk
 * @param chunkTimeoutMinutes   a chunk running longer than this is killed and counts as failed
 * @param stopGraceSeconds      after SIGTERM, how long the engine gets to clean up before it is killed
 * @param maxActiveGuestJobs    how many videos a guest can have running at once
 * @param maxActiveUserJobs     how many videos a signed-in user can have running at once
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(String mediaServiceUrl, String storageRoot, double chunkSeconds,
                            String bffEventsUrl, String internalKey,
                            String pythonCommand, String engineDir, int engineThreads,
                            long progressIntervalMs, long chunkTimeoutMinutes, long stopGraceSeconds,
                            int maxActiveGuestJobs, int maxActiveUserJobs) {
}
