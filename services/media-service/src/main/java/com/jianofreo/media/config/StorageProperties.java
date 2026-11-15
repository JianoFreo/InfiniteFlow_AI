package com.jianofreo.media.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

/**
 * Where files live on the shared /data volume.
 * The interpolation-engine mounts the same volume, so a path stored here is valid in every container.
 */
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

    /** Scratch folder for one job: the engine writes its processed chunks here. */
    public Path jobDir(Integer jobId) {
        return rootPath().resolve("jobs").resolve(String.valueOf(jobId));
    }
}
