package com.jianofreo.job.dto.message;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Broadcast on job.events. The BFF forwards it to browsers over SSE. status DELETED means the job is gone. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobEvent {
    private Integer jobId;
    private String status;
    private Integer progress;
    private Integer completedChunks;
    private Integer totalChunks;
}
