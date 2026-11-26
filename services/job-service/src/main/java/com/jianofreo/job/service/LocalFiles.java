package com.jianofreo.job.service;

import com.jianofreo.job.client.MediaClient;
import com.jianofreo.job.config.AppProperties;
import com.jianofreo.job.dto.engine.ChunkTask;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.FileSystemUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * This service's own scratch files. The Python engine reads and writes local files, and services do not
 * share a disk, so each job gets a copy of the source video (downloaded once) and its processed chunks.
 *
 *   {storageRoot}/jobs/{jobId}/source.video
 *   {storageRoot}/jobs/{jobId}/chunk_00000.mp4 ...
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LocalFiles {

    private final AppProperties props;
    private final MediaClient mediaClient;

    /** One lock per job, so several engine threads download its source only once. */
    private final Map<Integer, Object> locks = new ConcurrentHashMap<>();

    public Path sourcePath(Integer jobId) {
        return jobDir(jobId).resolve("source.video");
    }

    public Path chunkPath(Integer jobId, int chunkIndex) {
        return jobDir(jobId).resolve(String.format("chunk_%05d.mp4", chunkIndex));
    }

    /** Called before the engine runs: downloads the source video if it is not here yet. */
    public void ensureSource(ChunkTask task) {
        Integer jobId = task.getJobId();
        synchronized (locks.computeIfAbsent(jobId, id -> new Object())) {
            Path source = sourcePath(jobId);
            if (Files.isRegularFile(source)) {
                return;
            }
            Path part = source.resolveSibling("source.part");
            try {
                Files.createDirectories(source.getParent());
                mediaClient.download(task.getSourceMediaId(), part);
                Files.move(part, source, StandardCopyOption.REPLACE_EXISTING); // never a half-downloaded source
            } catch (IOException e) {
                throw new IllegalStateException("Could not save the source video", e);
            }
        }
    }

    public void deleteJobQuietly(Integer jobId) {
        locks.remove(jobId);
        deleteQuietly(jobDir(jobId));
    }

    /** After a restart no job is running, so everything left over can go. */
    public void deleteAllQuietly() {
        deleteQuietly(Path.of(props.storageRoot(), "jobs"));
    }

    private Path jobDir(Integer jobId) {
        return Path.of(props.storageRoot(), "jobs", String.valueOf(jobId));
    }

    private static void deleteQuietly(Path path) {
        try {
            FileSystemUtils.deleteRecursively(path);
        } catch (IOException e) {
            log.warn("could_not_delete path={} error={}", path, e.getMessage());
        }
    }
}
