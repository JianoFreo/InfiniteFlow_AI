import type { Request, Response } from "express";
import { jobService } from "../../clients/jobService.client.js";
import type { ServiceUser } from "../../clients/jobService.client.js";
import { forwardServiceError } from "../../utils/forwardServiceError.js";
import { signToken } from "../../utils/token.js";
import type * as dto from "./dto/post.dto.js";

const GUEST_ID = /^[A-Za-z0-9-]{16,64}$/;

const toSession = (user: ServiceUser, moved: number) => ({
  token: signToken(user),
  user: { id: user.id, email: user.email, name: user.name },
  moved,
});

/** The browser sends its guest id, so the videos it already made follow the person into the account. */
const adoptGuestJobs = async (req: Request, user: ServiceUser): Promise<number> => {
  const guest = req.headers["x-guest-id"];
  if (typeof guest !== "string" || !GUEST_ID.test(guest)) return 0;
  try {
    return await jobService.claimJobs(`g:${guest}`, `u:${user.id}`);
  } catch (err) {
    console.warn("[bff] could not move guest jobs:", err instanceof Error ? err.message : err);
    return 0;
  }
};

export const register = async (req: Request, res: Response<dto.register.response | dto.register.error>) => {
  const { email, password, name } = (req.body ?? {}) as dto.register.body;
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    const user = await jobService.register({ email, password, name: typeof name === "string" ? name : undefined });
    const moved = await adoptGuestJobs(req, user);
    return res.status(201).json({ message: "Account created", ...toSession(user, moved) });
  } catch (err) {
    return forwardServiceError(err, res, "Could not create the account");
  }
};

export const login = async (req: Request, res: Response<dto.login.response | dto.login.error>) => {
  const { email, password } = (req.body ?? {}) as dto.login.body;
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    const user = await jobService.login({ email, password });
    const moved = await adoptGuestJobs(req, user);
    return res.status(200).json({ message: "Logged in", ...toSession(user, moved) });
  } catch (err) {
    return forwardServiceError(err, res, "Could not log in");
  }
};
