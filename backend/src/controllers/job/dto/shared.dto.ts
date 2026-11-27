/**
 * Two kinds of types live here:
 *  - Service*  : exactly what job-service / media-service return (Spring, camelCase, UPPERCASE statuses)
 *  - *View     : what the BFF gives the frontend. The BFF's job is to turn the first into the second.
 */

export type ServiceJobStatus = "QUEUED" | "PROCESSING" | "MERGING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface ServiceJob {
  id: number;
  status: ServiceJobStatus;
  mode: "flow" | "blend";
  factor: number;
  progress: number;
  errorMessage: string | null;
  sourceMediaId: number;
  outputMediaId: number | null;
  fileName: string;
  fps: string;
  fpsValue: number;
  outputFpsValue: number;
  width: number;
  height: number;
  frameCount: number;
  outputFrameCount: number;
  durationMs: number;
  hasAudio: boolean;
  sourceSizeBytes: number | null;
  outputSizeBytes: number | null;
  totalChunks: number;
  completedChunks: number;
  createdAt: string;
  updatedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  preprocess?: string | null;
  ownerId: string;
}

export interface ServiceChunk {
  index: number;
  startFrame: number;
  frameCount: number;
  framesDone: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  worker: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ServiceMedia {
  id: number;
  kind: "SOURCE" | "OUTPUT";
  fileName: string;
  path: string;
  sizeBytes: number;
  fps: string;
  fpsValue: number;
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  hasAudio: boolean;
}

export type JobStatus = "queued" | "processing" | "merging" | "completed" | "failed" | "cancelled";

export interface JobView {
  id: number;
  status: JobStatus;
  mode: "flow" | "blend";
  factor: number;
  preprocess: string[];
  progress: number;
  error: string | null;
  source: {
    fileName: string;
    width: number;
    height: number;
    fps: number;
    frameCount: number;
    durationMs: number;
    hasAudio: boolean;
    sizeBytes: number | null;
  };
  output: {
    fps: number;
    frameCount: number;
    sizeBytes: number | null;
    downloadUrl: string | null;
  };
  chunks: { total: number; completed: number };
  timing: {
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    /** Upload finished → video ready. Null while running. */
    totalMs: number | null;
  };
}

export interface ChunkView {
  index: number;
  startFrame: number;
  frameCount: number;
  framesDone: number;
  status: "pending" | "processing" | "completed" | "failed";
  worker: string | null;
  durationMs: number | null;
}

export interface JobDetailView extends JobView {
  chunkList: ChunkView[];
}

export interface ErrorResponse {
  message: string;
  /** Set for plan limits: "too_many_running" | "plan_limit" | "quota_exceeded". The frontend offers an upgrade. */
  code?: string;
}
