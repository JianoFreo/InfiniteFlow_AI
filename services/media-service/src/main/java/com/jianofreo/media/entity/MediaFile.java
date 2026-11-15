package com.jianofreo.media.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "media_files")
public class MediaFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Enumerated(EnumType.STRING)
    private MediaKind kind;

    private String fileName;
    private String storedPath;
    private Long sizeBytes;

    /** Exact frame rate as a fraction, e.g. "30000/1001". The engine needs the exact value. */
    private String fps;
    /** Same frame rate as a number, for display. */
    private Double fpsValue;

    private Integer width;
    private Integer height;
    private Integer frameCount;
    private Long durationMs;
    private Boolean hasAudio;

    private Instant createdAt;
}
