import { describe, expect, it } from "vitest";
import { outputFileName, toChunkView, toJobView } from "../../utils/toJobView.js";
import { serviceJob } from "../helper/fixtures.js";

describe("toJobView", () => {
  it("lowercases status and rounds fps for display", () => {
    const view = toJobView(serviceJob());
    expect(view.status).toBe("processing");
    expect(view.source.fps).toBe(29.97);
    expect(view.output.fps).toBe(119.88);
    expect(view.chunks).toEqual({ total: 5, completed: 2 });
  });

  it("only exposes a download URL once the job is completed with an output", () => {
    expect(toJobView(serviceJob()).output.downloadUrl).toBeNull();
    const done = toJobView(
      serviceJob({ status: "COMPLETED", outputMediaId: 9, finishedAt: "2026-11-15T10:00:12Z" }),
    );
    expect(done.output.downloadUrl).toBe("/api/jobs/7/download");
    expect(done.timing.totalMs).toBe(12_000);
  });

  it("names the output after the source and factor", () => {
    expect(outputFileName({ fileName: "skate.mov", factor: 4 })).toBe("skate_4x.mp4");
  });

  it("maps chunk timing", () => {
    const chunk = toChunkView({
      index: 0, startFrame: 0, frameCount: 60, framesDone: 60, status: "COMPLETED", worker: "engine-1",
      startedAt: "2026-11-15T10:00:01Z", finishedAt: "2026-11-15T10:00:03.500Z",
    });
    expect(chunk).toMatchObject({ status: "completed", durationMs: 2500, worker: "engine-1" });
  });
});
