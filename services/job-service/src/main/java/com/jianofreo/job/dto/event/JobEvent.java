package com.jianofreo.job.dto.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Sent to the BFF (POST /internal/job-events) every time a job changes. The BFF pushes it to the browsers
 * of the job owner over SSE. status DELETED means the job is gone.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobEvent {
    private Integer jobId;
    private String status;
    private Integer progress;
    private Integer completedChunks;
    private Integer totalChunks;
    /** Lets the BFF send the event only to the browsers of the job owner. */
    private String ownerId;
}
