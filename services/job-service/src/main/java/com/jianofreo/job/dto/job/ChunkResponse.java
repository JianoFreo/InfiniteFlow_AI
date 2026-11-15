package com.jianofreo.job.dto.job;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChunkResponse {
    private Integer index;
    private Integer startFrame;
    private Integer frameCount;
    private Integer framesDone;
    private String status;
    private String worker;
    private Instant startedAt;
    private Instant finishedAt;
}
