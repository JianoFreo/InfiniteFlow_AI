/** Mirrors the BFF's JobView / JobDetailView (backend/src/controllers/job/dto/shared.dto.ts). */

export type JobStatus = "queued" | "processing" | "merging" | "completed" | "failed" | "cancelled";
export type JobMode = "flow" | "blend";
export type PreprocessStep = "denoise" | "deband" | "sharpen";

export interface Job {
  id: number;
  status: JobStatus;
  mode: JobMode;
  factor: number;
  preprocess: PreprocessStep[];
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
    totalMs: number | null;
  };
}

export type ChunkStatus = "pending" | "processing" | "completed" | "failed";

export interface Chunk {
  index: number;
  startFrame: number;
  frameCount: number;
  framesDone: number;
  status: ChunkStatus;
  worker: string | null;
  durationMs: number | null;
}

export interface JobDetail extends Job {
  chunkList: Chunk[];
}

/** One item of an SSE "job-changed" batch. */
export interface JobChangeEvent {
  id: number;
  status: JobStatus | "deleted";
  progress: number;
  completedChunks: number;
  totalChunks: number;
}

export const ACTIVE_STATUSES: JobStatus[] = ["queued", "processing", "merging"];
export const isActive = (job: Pick<Job, "status">) => ACTIVE_STATUSES.includes(job.status);
