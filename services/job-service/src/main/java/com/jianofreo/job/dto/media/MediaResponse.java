package com.jianofreo.job.dto.media;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** What media-service returns. Each service keeps its own copy of the contract; no shared jar between services. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true) // tolerate fields the other service adds later
public class MediaResponse {
    private Integer id;
    private String kind;
    private String fileName;
    private String path;
    private Long sizeBytes;
    private String fps;
    private Double fpsValue;
    private Integer width;
    private Integer height;
    private Integer frameCount;
    private Long durationMs;
    private Boolean hasAudio;
}
