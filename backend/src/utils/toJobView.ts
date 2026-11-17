import type {
  ChunkView,
  JobDetailView,
  JobStatus,
  JobView,
  ServiceChunk,
  ServiceJob,
} from "../controllers/job/dto/shared.dto.js";

/**
 * The adapter part of the BFF: reshapes job-service's flat Spring DTO into what the UI renders.
 * If job-service renames a field, only this file changes, not every React component.
 */
export const toJobView = (job: ServiceJob): JobView => {
  const status = job.status.toLowerCase() as JobStatus;
  const startedAt = job.createdAt ? Date.parse(job.createdAt) : NaN;
  const finishedAt = job.finishedAt ? Date.parse(job.finishedAt) : NaN;
  const completed = status === "completed" && job.outputMediaId != null;

  return {
    id: job.id,
    status,
    mode: job.mode,
    factor: job.factor,
    preprocess: job.preprocess ? job.preprocess.split(",") : [],
    progress: job.progress ?? 0,
    error: job.errorMessage,
    source: {
      fileName: job.fileName,
      width: job.width,
      height: job.height,
      fps: round(job.fpsValue),
      frameCount: job.frameCount,
      durationMs: job.durationMs,
      hasAudio: Boolean(job.hasAudio),
      sizeBytes: job.sourceSizeBytes,
    },
    output: {
      fps: round(job.outputFpsValue),
      frameCount: job.outputFrameCount,
      sizeBytes: job.outputSizeBytes,
      downloadUrl: completed ? `/api/jobs/${job.id}/download` : null,
    },
    chunks: { total: job.totalChunks ?? 0, completed: job.completedChunks ?? 0 },
    timing: {
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      totalMs: completed && !Number.isNaN(startedAt) && !Number.isNaN(finishedAt) ? finishedAt - startedAt : null,
    },
  };
};

export const toChunkView = (chunk: ServiceChunk): ChunkView => {
  const started = chunk.startedAt ? Date.parse(chunk.startedAt) : NaN;
  const finished = chunk.finishedAt ? Date.parse(chunk.finishedAt) : NaN;
  return {
    index: chunk.index,
    startFrame: chunk.startFrame,
    frameCount: chunk.frameCount,
    framesDone: chunk.framesDone,
    status: chunk.status.toLowerCase() as ChunkView["status"],
    worker: chunk.worker,
    durationMs: Number.isNaN(started) || Number.isNaN(finished) ? null : finished - started,
  };
};

export const toJobDetailView = (job: ServiceJob, chunks: ServiceChunk[]): JobDetailView => ({
  ...toJobView(job),
  chunkList: chunks.map(toChunkView),
});

/** "clip.mov" + 4 → "clip_4x.mp4" */
export const outputFileName = (job: Pick<ServiceJob, "fileName" | "factor">) =>
  `${(job.fileName || "video").replace(/\.[^.]+$/, "")}_${job.factor}x.mp4`;

const round = (value: number | null | undefined) => (value == null ? 0 : Math.round(value * 100) / 100);
