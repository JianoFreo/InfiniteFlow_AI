package com.jianofreo.job.dto.job;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobResponse {
    private Integer id;
    private String status;
    private String mode;
    private Integer factor;
    private Integer progress;
    private String errorMessage;

    private Integer sourceMediaId;
    private Integer outputMediaId;

    private String fileName;
    private String fps;
    private Double fpsValue;
    private Double outputFpsValue;
    private Integer width;
    private Integer height;
    private Integer frameCount;
    private Integer outputFrameCount;
    private Long durationMs;
    private Boolean hasAudio;
    private Long sourceSizeBytes;
    private Long outputSizeBytes;

    private Integer totalChunks;
    private Integer completedChunks;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant startedAt;
    private Instant finishedAt;

    private String preprocess;
    private String ownerId;
}
