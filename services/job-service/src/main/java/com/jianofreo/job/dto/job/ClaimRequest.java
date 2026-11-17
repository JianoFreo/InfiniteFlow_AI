package com.jianofreo.job.dto.job;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Moves every job of a guest browser to an account (done once, right after sign up or login). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClaimRequest {
    @NotBlank
    @Size(max = 64)
    private String from;

    @NotBlank
    @Size(max = 64)
    private String to;
}
