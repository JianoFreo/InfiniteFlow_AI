package com.jianofreo.media.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

/** Where this service keeps its files. Other services get them over HTTP, never from this folder. */
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(String root) {

    public Path rootPath() {
        return Path.of(root).toAbsolutePath().normalize();
    }

    public Path uploadsDir() {
        return rootPath().resolve("uploads");
    }

    public Path outputsDir() {
        return rootPath().resolve("outputs");
    }

    /** Scratch folder for one job: job-service uploads its processed chunks here before the merge. */
    public Path jobDir(Integer jobId) {
        return rootPath().resolve("jobs").resolve(String.valueOf(jobId));
    }
}
