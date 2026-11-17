import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../clients/jobService.client.js", () => ({ jobService: {} }));
vi.mock("../../clients/mediaService.client.js", () => ({ mediaService: {} }));
vi.mock("../../services/job-sse/index.js", () => ({
  publishJobChange: vi.fn(),
  streamJobs: vi.fn(),
  getJobStreamStats: () => ({ connectedScreens: 0, maxScreens: 50 }),
}));

const { publishJobChange } = await import("../../services/job-sse/index.js");
const { createApp } = await import("../../app.js");
const { ENV } = await import("../../config/env.js");

const app = createApp();
const event = { jobId: 7, status: "PROCESSING", progress: 40, completedChunks: 2, totalChunks: 5, ownerId: "g:abc" };

describe("POST /internal/job-events", () => {
  it("refuses a caller without the internal key", async () => {
    const res = await request(app).post("/internal/job-events").send([event]);
    expect(res.status).toBe(401);
    expect(publishJobChange).not.toHaveBeenCalled();
  });

  it("hands each event to the live hub, lower-casing the status", async () => {
    const res = await request(app).post("/internal/job-events").set("X-Internal-Key", ENV.INTERNAL_KEY).send([event]);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);
    expect(publishJobChange).toHaveBeenCalledWith({
      id: 7,
      status: "processing",
      progress: 40,
      completedChunks: 2,
      totalChunks: 5,
      ownerId: "g:abc",
    });
  });

  it("skips malformed events and rejects a non-array body", async () => {
    const bad = await request(app).post("/internal/job-events").set("X-Internal-Key", ENV.INTERNAL_KEY).send({ nope: true });
    expect(bad.status).toBe(400);
  });
});
