package com.jianofreo.job.dto.engine;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One line the Python engine prints on stdout.
 * event is "progress", "done", "cancelled" or "error".
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class EngineEvent {
    private String event;
    private Integer framesDone;
    private Integer framesWritten;
    private String outputPath;
    private String message;
}
