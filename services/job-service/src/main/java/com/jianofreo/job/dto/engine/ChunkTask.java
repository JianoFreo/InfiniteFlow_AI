package com.jianofreo.job.dto.engine;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One slice of a job, handed to the Python engine on its stdin (see interpolation-engine/app/run_chunk.py).
 * The engine decodes frames [startFrame, startFrame + frameCount] from sourcePath. The extra +1 frame is the
 * first frame of the NEXT chunk, needed to make the in-betweens across the boundary (skipped when last=true).
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
    /** Comma-separated pre-processing steps (denoise, deband, sharpen), or null for none. */
    private String preprocess;
    /** Used by Java to download the source video. Not sent to Python. */
    @JsonIgnore
    private Integer sourceMediaId;
}
