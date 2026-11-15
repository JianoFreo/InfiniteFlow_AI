package com.jianofreo.media.service;

import com.jianofreo.media.dto.media.ProbeResult;
import com.jianofreo.media.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Wraps the ffprobe / ffmpeg command line tools.
 * This service only ever copies streams (it never re-encodes video), so every call here is fast.
 * The expensive pixel work happens in the interpolation-engine.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FfmpegService {

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(60);
    private static final Duration MERGE_TIMEOUT = Duration.ofMinutes(30);

    private final ObjectMapper objectMapper;

    public ProbeResult probe(Path video) {
        String json = run(List.of(
                "ffprobe", "-v", "error",
                "-print_format", "json",
                "-show_format", "-show_streams",
                video.toString()
        ), PROBE_TIMEOUT);

        JsonNode root = objectMapper.readTree(json);
        JsonNode videoStream = null;
        boolean hasAudio = false;
        for (JsonNode stream : root.path("streams")) {
            String type = stream.path("codec_type").asString("");
            if ("video".equals(type) && videoStream == null && !isAttachedPicture(stream)) {
                videoStream = stream;
            }
            if ("audio".equals(type)) {
                hasAudio = true;
            }
        }
        if (videoStream == null) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "File has no video stream");
        }

        String fps = pickFrameRate(videoStream);
        double fpsValue = rationalToDouble(fps);

        int width = videoStream.path("width").asInt(0);
        int height = videoStream.path("height").asInt(0);
        // Phones store portrait video as landscape + a rotation flag. ffmpeg auto-rotates
        // when decoding, so the engine will receive frames with width/height swapped.
        int rotation = Math.abs(readRotation(videoStream)) % 180;
        if (rotation == 90) {
            int tmp = width;
            width = height;
            height = tmp;
        }

        double durationSec = videoStream.path("duration").asDouble(0);
        if (durationSec <= 0) {
            durationSec = root.path("format").path("duration").asDouble(0);
        }

        int frameCount = videoStream.path("nb_frames").asInt(0);
        if (frameCount <= 0) {
            frameCount = (int) Math.round(durationSec * fpsValue);
        }

        return new ProbeResult(fps, fpsValue, width, height, frameCount,
                Math.round(durationSec * 1000), hasAudio);
    }

    /**
     * Joins the processed chunks back into one file without re-encoding them (concat demuxer),
     * and copies the audio from the original upload, re-encoded to AAC so any source codec fits in MP4.
     */
    public void merge(List<Path> chunks, Path source, boolean sourceHasAudio, Path listFile, Path output) {
        StringBuilder list = new StringBuilder();
        for (Path chunk : chunks) {
            list.append("file '").append(chunk.toString().replace("'", "'\\''")).append("'\n");
        }
        try {
            Files.writeString(listFile, list.toString(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not write concat list", e);
        }

        List<String> cmd = new ArrayList<>(List.of(
                "ffmpeg", "-y", "-v", "error",
                "-f", "concat", "-safe", "0", "-i", listFile.toString()));
        if (sourceHasAudio) {
            cmd.addAll(List.of("-i", source.toString(), "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k"));
        } else {
            cmd.addAll(List.of("-map", "0:v:0"));
        }
        cmd.addAll(List.of("-c:v", "copy", "-movflags", "+faststart", output.toString()));

        run(cmd, MERGE_TIMEOUT);
    }

    private static boolean isAttachedPicture(JsonNode stream) {
        return stream.path("disposition").path("attached_pic").asInt(0) == 1;
    }

    /** avg_frame_rate is the real rate for most files; r_frame_rate is the fallback. */
    private static String pickFrameRate(JsonNode stream) {
        for (String key : List.of("avg_frame_rate", "r_frame_rate")) {
            String value = stream.path(key).asString("");
            double asNumber = rationalToDouble(value);
            if (asNumber > 0 && asNumber <= 240) {
                return value.contains("/") ? value : value + "/1";
            }
        }
        throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Could not read the video frame rate");
    }

    private static int readRotation(JsonNode stream) {
        for (JsonNode sideData : stream.path("side_data_list")) {
            if (sideData.has("rotation")) {
                return sideData.path("rotation").asInt(0);
            }
        }
        return stream.path("tags").path("rotate").asInt(0);
    }

    static double rationalToDouble(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        try {
            String[] parts = value.split("/");
            double num = Double.parseDouble(parts[0]);
            double den = parts.length > 1 ? Double.parseDouble(parts[1]) : 1;
            return den == 0 ? 0 : num / den;
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** Runs a command and returns its stdout. stdout/stderr go to temp files so a chatty process can never block. */
    private String run(List<String> cmd, Duration timeout) {
        File out = null;
        File err = null;
        try {
            out = File.createTempFile("ff-out", ".txt");
            err = File.createTempFile("ff-err", ".txt");
            Process process = new ProcessBuilder(cmd)
                    .redirectOutput(out)
                    .redirectError(err)
                    .start();
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new IllegalStateException(cmd.get(0) + " timed out");
            }
            if (process.exitValue() != 0) {
                String stderr = Files.readString(err.toPath()).trim();
                log.warn("{} failed: {}", cmd.get(0), stderr);
                throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                        cmd.get(0) + " failed: " + (stderr.isEmpty() ? "exit " + process.exitValue() : lastLine(stderr)));
            }
            return Files.readString(out.toPath());
        } catch (IOException e) {
            throw new IllegalStateException("Could not run " + cmd.get(0), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while running " + cmd.get(0), e);
        } finally {
            if (out != null) out.delete();
            if (err != null) err.delete();
        }
    }

    private static String lastLine(String text) {
        String[] lines = text.split("\\R");
        return lines[lines.length - 1];
    }
}
