import type { PlanLimits, PlanName, ServiceUsage } from "../../clients/jobService.client.js";
import type { ServiceJob } from "../../controllers/job/dto/shared.dto.js";

const PLANS: Record<PlanName, PlanLimits> = {
  guest: { dailySeconds: 30, maxClipSeconds: 10, maxFactor: 2, maxActive: 1 },
  free: { dailySeconds: 180, maxClipSeconds: 30, maxFactor: 4, maxActive: 2 },
  pro: { dailySeconds: 1800, maxClipSeconds: 180, maxFactor: 8, maxActive: 5 },
};

/** Usage as job-service would return it. Guest with nothing used, unless overridden. */
export const serviceUsage = (overrides: Partial<ServiceUsage> = {}): ServiceUsage => {
  const plan = overrides.plan ?? "guest";
  return {
    plan,
    limits: PLANS[plan],
    usedSeconds: 0,
    remainingSeconds: PLANS[plan].dailySeconds,
    resetsAt: null,
    activeJobs: 0,
    subscriptionStatus: null,
    renewsAt: null,
    plans: PLANS,
    ...overrides,
  };
};

/** A job as job-service would return it. */
export const serviceJob = (overrides: Partial<ServiceJob> = {}): ServiceJob => ({
  id: 7,
  status: "PROCESSING",
  mode: "flow",
  ownerId: "g:test-guest-id-0001",
  factor: 4,
  progress: 40,
  errorMessage: null,
  sourceMediaId: 3,
  outputMediaId: null,
  fileName: "skate.mov",
  fps: "30000/1001",
  fpsValue: 29.97002997,
  outputFpsValue: 119.88011988,
  width: 1920,
  height: 1080,
  frameCount: 300,
  outputFrameCount: 1197,
  durationMs: 10010,
  hasAudio: true,
  sourceSizeBytes: 1000,
  outputSizeBytes: null,
  totalChunks: 5,
  completedChunks: 2,
  createdAt: "2026-11-15T10:00:00Z",
  updatedAt: "2026-11-15T10:00:05Z",
  startedAt: "2026-11-15T10:00:01Z",
  finishedAt: null,
  ...overrides,
});
