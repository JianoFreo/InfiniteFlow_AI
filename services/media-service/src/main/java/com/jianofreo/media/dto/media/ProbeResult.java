package com.jianofreo.media.dto.media;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** What ffprobe told us about a video file. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProbeResult {
    private String fps;
    private Double fpsValue;
    private Integer width;
    private Integer height;
    private Integer frameCount;
    private Long durationMs;
    private Boolean hasAudio;
}
