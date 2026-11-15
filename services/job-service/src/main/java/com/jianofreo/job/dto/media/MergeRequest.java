package com.jianofreo.job.dto.media;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MergeRequest {
    private Integer jobId;
    private Integer sourceMediaId;
    private List<String> chunkPaths;
    private String outputFileName;
}
