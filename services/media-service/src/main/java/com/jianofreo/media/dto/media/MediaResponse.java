package com.jianofreo.media.dto.media;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
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
    private Instant createdAt;
}
