package com.jianofreo.media.dto.media;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Sent by job-service once every chunk of a job is processed. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MergeRequest {
    @NotNull
    private Integer jobId;
    @NotNull
    private Integer sourceMediaId;
    /** Numbers of the uploaded chunks, in playback order. */
    @NotEmpty
    private List<Integer> chunkIndexes;
    /** Name for the merged file, e.g. "clip_4x.mp4". */
    private String outputFileName;
}
