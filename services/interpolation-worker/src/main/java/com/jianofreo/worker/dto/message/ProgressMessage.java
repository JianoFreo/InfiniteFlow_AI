package com.jianofreo.worker.dto.message;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Sent to job-service on interp.progress. status is PROGRESS, DONE or FAILED. Same shape job-service reads. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProgressMessage {
    private Integer jobId;
    private Integer chunkIndex;
    private String status;
    /** How many source frames of this chunk are finished. */
    private Integer framesDone;
    /** Set on DONE. Null when the chunk turned out to be empty. */
    private String outputPath;
    private String error;
    private String worker;
}
