package com.jianofreo.job.entity;

/**
 * QUEUED → PROCESSING → MERGING → COMPLETED
 *    └──────────┴───────────┴────→ FAILED / CANCELLED
 */
public enum JobStatus {
    QUEUED,
    PROCESSING,
    MERGING,
    COMPLETED,
    FAILED,
    CANCELLED;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == CANCELLED;
    }
}
