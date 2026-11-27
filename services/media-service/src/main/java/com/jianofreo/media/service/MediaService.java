package com.jianofreo.media.service;

import com.jianofreo.media.config.StorageProperties;
import com.jianofreo.media.dto.media.MediaResponse;
import com.jianofreo.media.dto.media.MergeRequest;
import com.jianofreo.media.dto.media.ProbeResult;
import com.jianofreo.media.entity.MediaFile;
import com.jianofreo.media.entity.MediaKind;
import com.jianofreo.media.exception.ApiException;
import com.jianofreo.media.repository.MediaFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.FileSystemUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaService {

    private final MediaFileRepository mediaFileRepository;
    private final FfmpegService ffmpegService;
    private final StorageProperties storage;

    public MediaResponse upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("No file uploaded");
        }
        String originalName = cleanFileName(file.getOriginalFilename());
        Path target = storage.uploadsDir().resolve(UUID.randomUUID() + extensionOf(originalName));

        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target);
        } catch (IOException e) {
            throw new IllegalStateException("Could not store upload", e);
        }

        ProbeResult probe;
        try {
            probe = ffmpegService.probe(target);
        } catch (RuntimeException e) {
            deleteQuietly(target);
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "This file is not a readable video");
        }
        if (probe.getFrameCount() < 2) {
            deleteQuietly(target);
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Video must contain at least two frames");
        }

        MediaFile saved = mediaFileRepository.save(toEntity(MediaKind.SOURCE, originalName, target, probe));
        log.info("media_uploaded id={} file={} {}x{} @{}fps frames={}", saved.getId(), originalName,
                probe.getWidth(), probe.getHeight(), probe.getFps(), probe.getFrameCount());
        return toResponse(saved);
    }

    public MediaResponse getMedia(Integer id) {
        return toResponse(findMedia(id));
    }

    public MediaFile findMedia(Integer id) {
        return mediaFileRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Media " + id + " not found"));
    }

    /** Glues the engine's processed chunks into the final video, then removes the job's scratch folder. */
    public MediaResponse merge(MergeRequest request) {
        MediaFile source = findMedia(request.getSourceMediaId());
        Path jobDir = storage.jobDir(request.getJobId()).normalize();

        List<Path> chunks = new ArrayList<>();
        for (String raw : request.getChunkPaths()) {
            Path chunk = Path.of(raw).toAbsolutePath().normalize();
            if (!chunk.startsWith(jobDir)) {
                throw ApiException.badRequest("Chunk path is outside the job folder: " + raw);
            }
            // An empty chunk is normal: it happens when the real frame count was a bit lower than the estimate.
            if (Files.isRegularFile(chunk) && sizeOf(chunk) > 0) {
                chunks.add(chunk);
            }
        }
        if (chunks.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "No processed chunks to merge");
        }

        Path output = storage.outputsDir().resolve(request.getJobId() + "_" + UUID.randomUUID() + ".mp4");
        try {
            Files.createDirectories(output.getParent());
        } catch (IOException e) {
            throw new IllegalStateException("Could not create outputs folder", e);
        }

        long started = System.currentTimeMillis();
        ffmpegService.merge(chunks, Path.of(source.getStoredPath()), Boolean.TRUE.equals(source.getHasAudio()),
                jobDir.resolve("concat.txt"), output);
        ProbeResult probe = ffmpegService.probe(output);

        String fileName = request.getOutputFileName() != null && !request.getOutputFileName().isBlank()
                ? cleanFileName(request.getOutputFileName())
                : "infiniteflow_" + request.getJobId() + ".mp4";
        MediaFile saved = mediaFileRepository.save(toEntity(MediaKind.OUTPUT, fileName, output, probe));

        deleteWorkdir(request.getJobId());
        log.info("media_merged job={} chunks={} output={} took={}ms", request.getJobId(), chunks.size(),
                saved.getId(), System.currentTimeMillis() - started);
        return toResponse(saved);
    }

    @Transactional
    public void deleteMedia(Integer id) {
        MediaFile media = findMedia(id);
        deleteQuietly(Path.of(media.getStoredPath()));
        mediaFileRepository.delete(media);
    }

    public void deleteWorkdir(Integer jobId) {
        try {
            FileSystemUtils.deleteRecursively(storage.jobDir(jobId));
        } catch (IOException e) {
            log.warn("Could not delete workdir for job {}: {}", jobId, e.getMessage());
        }
    }

    private MediaFile toEntity(MediaKind kind, String fileName, Path path, ProbeResult probe) {
        return new MediaFile(null, kind, fileName, path.toString(), sizeOf(path),
                probe.getFps(), probe.getFpsValue(), probe.getWidth(), probe.getHeight(),
                probe.getFrameCount(), probe.getDurationMs(), probe.getHasAudio(), Instant.now());
    }

    private MediaResponse toResponse(MediaFile media) {
        return new MediaResponse(media.getId(), media.getKind().name(), media.getFileName(), media.getStoredPath(),
                media.getSizeBytes(), media.getFps(), media.getFpsValue(), media.getWidth(), media.getHeight(),
                media.getFrameCount(), media.getDurationMs(), media.getHasAudio(), media.getCreatedAt());
    }

    private static String cleanFileName(String name) {
        if (name == null || name.isBlank()) {
            return "video.mp4";
        }
        String base = Path.of(name.replace('\\', '/')).getFileName().toString();
        return base.replaceAll("[^A-Za-z0-9._ -]", "_");
    }

    private static String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot).toLowerCase() : ".mp4";
    }

    private static long sizeOf(Path path) {
        try {
            return Files.size(path);
        } catch (IOException e) {
            return 0;
        }
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("Could not delete {}: {}", path, e.getMessage());
        }
    }
}
