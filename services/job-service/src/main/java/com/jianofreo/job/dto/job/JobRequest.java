package com.jianofreo.job.dto.job;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobRequest {
    @NotNull
    private Integer sourceMediaId;

    @NotNull
    @Min(2)
    @Max(8)
    private Integer factor;

    /** Optional, defaults to "flow". */
    @Pattern(regexp = "flow|blend", message = "must be 'flow' or 'blend'")
    private String mode;
}
