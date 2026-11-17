import type { Response } from "express";
import { jobService } from "../clients/jobService.client.js";
import type { ServiceJob } from "../controllers/job/dto/shared.dto.js";
import type { Identity } from "../middlewares/identity.middleware.js";

/** Fetches a job and makes sure it belongs to the caller. Someone else's job looks exactly like a missing one (404). */
export const loadOwnedJob = async (jobId: number, res: Response): Promise<ServiceJob | null> => {
  const identity: Identity = res.locals.identity;
  const job = await jobService.getJob(jobId);
  if (job.ownerId !== identity.owner) {
    res.status(404).json({ message: `Job ${jobId} not found` });
    return null;
  }
  return job;
};
