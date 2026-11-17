package com.jianofreo.worker.dto.message;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One unit of work from job-service (on interp.chunks). Same fields as job-service's ChunkTask.
 * The whole object is handed to the Python engine unchanged, on its stdin.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChunkTask {
    private Integer jobId;
    private Integer chunkIndex;
    private String sourcePath;
    private Integer startFrame;
    private Integer frameCount;
    private Boolean last;
    private Integer factor;
    private String mode;
    /** Exact source fps as a fraction, e.g. "30000/1001". */
    private String fps;
    private Integer width;
    private Integer height;
    private String outputPath;
    private String preprocess;
}
