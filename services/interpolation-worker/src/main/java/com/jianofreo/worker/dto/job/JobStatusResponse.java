package com.jianofreo.worker.dto.job;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** The two fields of job-service's GET /jobs/{id} the worker cares about. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class JobStatusResponse {
    private Integer id;
    private String status;
}
