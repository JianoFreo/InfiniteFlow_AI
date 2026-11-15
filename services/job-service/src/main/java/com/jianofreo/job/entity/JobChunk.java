package com.jianofreo.job.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** One slice of a job: frames [startFrame, startFrame + frameCount) of the source video. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "job_chunks")
public class JobChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "job_id")
    private Job job;

    private Integer chunkIndex;
    private Integer startFrame;
    private Integer frameCount;

    @Enumerated(EnumType.STRING)
    private ChunkStatus status;

    private String outputPath;
    /** Hostname of the engine replica that processed it, handy for seeing the parallelism in the UI. */
    private String worker;

    private Instant startedAt;
    private Instant finishedAt;
}
