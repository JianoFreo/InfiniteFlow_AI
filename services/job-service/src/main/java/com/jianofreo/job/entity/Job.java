package com.jianofreo.job.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "jobs")
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /**
     * Optimistic locking. The progress listener, the async merge and an HTTP cancel can all touch
     * the same job; without this, a late progress save could overwrite CANCELLED with PROCESSING.
     */
    @Version
    private Integer version;

    @Enumerated(EnumType.STRING)
    private JobStatus status;

    /** "flow" (optical flow, default) or "blend" (simple cross-fade, fastest). */
    private String mode;
    private Integer factor;
    private Integer progress;

    @Column(length = 2000)
    private String errorMessage;

    private Integer sourceMediaId;
    private Integer outputMediaId;

    // Copied from media-service when the job is created, so listing jobs never has to call media-service.
    private String fileName;
    private String sourcePath;
    private String fps;
    private Double fpsValue;
    private Integer width;
    private Integer height;
    private Integer frameCount;
    private Long durationMs;
    private Boolean hasAudio;
    private Long sourceSizeBytes;
    private Long outputSizeBytes;

    private Integer totalChunks;
    private Integer completedChunks;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant startedAt;
    private Instant finishedAt;

    /** Comma-separated pre-processing steps applied to every frame before interpolation, or null. */
    private String preprocess;

    /** Who owns the job: "u:<userId>" for an account, "g:<guestId>" for a guest browser. */
    @Column(length = 64)
    private String ownerId;

    /** Hash of the uploader's IP (from the BFF). Guests are rate limited by this too, not only by their browser id. */
    @Column(length = 64)
    private String clientKey;
}
