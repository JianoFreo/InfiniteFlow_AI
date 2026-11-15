package com.jianofreo.worker.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param jobServiceUrl       base URL of job-service, asked whether a job is still active before a chunk starts
 * @param name                this replica's name, reported with every progress message
 * @param pythonCommand       the Python interpreter that runs the engine
 * @param engineDir           directory containing the engine's {@code app} package (the child process's working dir)
 * @param progressIntervalMs  minimum time between two progress reports for one chunk
 * @param chunkTimeoutMinutes a chunk running longer than this is killed and counts as failed
 * @param stopGraceSeconds    after SIGTERM, how long the engine gets to clean up before it is killed
 */
@ConfigurationProperties(prefix = "worker")
public record WorkerProperties(String jobServiceUrl, String name, String pythonCommand, String engineDir,
                               long progressIntervalMs, long chunkTimeoutMinutes, long stopGraceSeconds) {
}
