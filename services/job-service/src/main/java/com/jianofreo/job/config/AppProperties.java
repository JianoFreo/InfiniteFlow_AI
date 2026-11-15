package com.jianofreo.job.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param mediaServiceUrl base URL of media-service, e.g. http://media-service:8082
 * @param storageRoot     the shared volume root; chunk outputs go to {storageRoot}/jobs/{jobId}/
 * @param chunkSeconds    how much video one engine task covers. Smaller = more parallelism, more overhead.
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(String mediaServiceUrl, String storageRoot, double chunkSeconds) {
}
