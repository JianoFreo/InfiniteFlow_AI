package com.jianofreo.job.dto.message;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One unit of work for the interpolation-engine (sent on interp.chunks).
 * The engine decodes frames [startFrame, startFrame + frameCount] from sourcePath. The extra +1 frame
 * is the next chunk's first frame, needed to generate the in-betweens across the boundary (skipped when last=true).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
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
}
