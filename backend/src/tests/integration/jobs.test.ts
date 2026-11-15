import request from "supertest";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The microservices are mocked: these tests check the BFF's own job (validation, aggregation, error mapping).
vi.mock("../../clients/jobService.client.js", () => ({
  jobService: {
    createJob: vi.fn(),
    listJobs: vi.fn(),
    getJob: vi.fn(),
    getChunks: vi.fn(),
    cancelJob: vi.fn(),
    deleteJob: vi.fn(),
    health: vi.fn(),
  },
}));
vi.mock("../../clients/mediaService.client.js", () => ({
  mediaService: { uploadStream: vi.fn(), streamContent: vi.fn(), deleteMedia: vi.fn(), health: vi.fn() },
}));

const { jobService } = await import("../../clients/jobService.client.js");
const { mediaService } = await import("../../clients/mediaService.client.js");
const { createApp } = await import("../../app.js");
const { serviceJob } = await import("../helper/fixtures.js");

const app = createApp();

const serviceError = (status: number, message: string) =>
  new AxiosError(message, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { message },
  });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/jobs", () => {
  it("rejects a bad factor before streaming anything", async () => {
    const res = await request(app).post("/api/jobs?factor=12").attach("file", Buffer.from("x"), "a.mp4");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/factor/);
    expect(mediaService.uploadStream).not.toHaveBeenCalled();
  });

  it("uploads to media-service, then creates the job in job-service", async () => {
    vi.mocked(mediaService.uploadStream).mockResolvedValue({ id: 3 } as never);
    vi.mocked(jobService.createJob).mockResolvedValue(serviceJob({ status: "QUEUED", progress: 0 }));

    const res = await request(app).post("/api/jobs?factor=4&mode=flow").attach("file", Buffer.from("x"), "a.mp4");

    expect(res.status).toBe(201);
    expect(res.body.job).toMatchObject({ id: 7, status: "queued", factor: 4 });
    expect(jobService.createJob).toHaveBeenCalledWith({ sourceMediaId: 3, factor: 4, mode: "flow" });
  });

  it("deletes the uploaded file when job creation fails", async () => {
    vi.mocked(mediaService.uploadStream).mockResolvedValue({ id: 3 } as never);
    vi.mocked(mediaService.deleteMedia).mockResolvedValue();
    vi.mocked(jobService.createJob).mockRejectedValue(serviceError(500, "boom"));

    const res = await request(app).post("/api/jobs?factor=2").attach("file", Buffer.from("x"), "a.mp4");

    expect(res.status).toBe(502);
    expect(mediaService.deleteMedia).toHaveBeenCalledWith(3);
  });

  it("passes media-service's 4xx message through", async () => {
    vi.mocked(mediaService.uploadStream).mockRejectedValue(serviceError(422, "This file is not a readable video"));
    const res = await request(app).post("/api/jobs?factor=2").attach("file", Buffer.from("x"), "a.txt");
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("This file is not a readable video");
  });
});

describe("GET /api/jobs/:job_id", () => {
  it("merges the job and its chunks into one response", async () => {
    vi.mocked(jobService.getJob).mockResolvedValue(serviceJob());
    vi.mocked(jobService.getChunks).mockResolvedValue([
      { index: 0, startFrame: 0, frameCount: 60, framesDone: 30, status: "PROCESSING", worker: "e1", startedAt: null, finishedAt: null },
    ]);
    const res = await request(app).get("/api/jobs/7");
    expect(res.status).toBe(200);
    expect(res.body.job.chunkList).toHaveLength(1);
    expect(res.body.job.chunkList[0]).toMatchObject({ status: "processing", framesDone: 30 });
  });

  it("validates the id", async () => {
    expect((await request(app).get("/api/jobs/abc")).status).toBe(400);
  });

  it("maps a 404 from job-service to 404", async () => {
    vi.mocked(jobService.getJob).mockRejectedValue(serviceError(404, "Job 99 not found"));
    vi.mocked(jobService.getChunks).mockRejectedValue(serviceError(404, "Job 99 not found"));
    const res = await request(app).get("/api/jobs/99");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Job 99 not found");
  });
});

describe("other routes", () => {
  it("refuses to download an unfinished job", async () => {
    vi.mocked(jobService.getJob).mockResolvedValue(serviceJob());
    expect((await request(app).get("/api/jobs/7/download")).status).toBe(409);
  });

  it("cancels", async () => {
    vi.mocked(jobService.cancelJob).mockResolvedValue(serviceJob({ status: "CANCELLED" }));
    const res = await request(app).patch("/api/jobs/7/cancel");
    expect(res.body.job.status).toBe("cancelled");
  });

  it("answers unknown API routes with JSON 404", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/No route/);
  });
});
