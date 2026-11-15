package com.jianofreo.job.dto.message;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Sent by the engine on interp.progress. status is PROGRESS, DONE or FAILED. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true) // tolerate fields the other service adds later
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
