import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../clients/jobService.client.js", () => ({
  jobService: { register: vi.fn(), login: vi.fn(), claimJobs: vi.fn() },
}));
vi.mock("../../clients/mediaService.client.js", () => ({ mediaService: {} }));

const { jobService } = await import("../../clients/jobService.client.js");
const { createApp } = await import("../../app.js");
const { verifyToken } = await import("../../utils/token.js");

const app = createApp();
const GUEST = "test-guest-id-0001";

beforeEach(() => vi.clearAllMocks());

describe("auth", () => {
  it("registers, returns a token and moves the guest's jobs into the account", async () => {
    vi.mocked(jobService.register).mockResolvedValue({ id: 4, email: "a@b.co", name: "Ana" });
    vi.mocked(jobService.claimJobs).mockResolvedValue(3);

    const res = await request(app).post("/api/auth/register").set("X-Guest-Id", GUEST).send({ email: "a@b.co", password: "longenough" });

    expect(res.status).toBe(201);
    expect(res.body.moved).toBe(3);
    expect(res.body.user).toEqual({ id: 4, email: "a@b.co", name: "Ana" });
    expect(verifyToken(res.body.token)?.sub).toBe(4);
    expect(jobService.claimJobs).toHaveBeenCalledWith(`g:${GUEST}`, "u:4");
  });

  it("logs in without a guest id and moves nothing", async () => {
    vi.mocked(jobService.login).mockResolvedValue({ id: 4, email: "a@b.co", name: null });
    const res = await request(app).post("/api/auth/login").send({ email: "a@b.co", password: "x" });
    expect(res.status).toBe(200);
    expect(jobService.claimJobs).not.toHaveBeenCalled();
  });

  it("rejects a body without email and password", async () => {
    expect((await request(app).post("/api/auth/login").send({})).status).toBe(400);
  });
});
