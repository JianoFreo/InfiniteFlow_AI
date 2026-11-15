import type { Request, Response } from "express";
import { jobService } from "../../clients/jobService.client.js";
import { forwardServiceError } from "../../utils/forwardServiceError.js";
import { toJobView } from "../../utils/toJobView.js";
import type * as dto from "./dto/update.dto.js";

export const cancelJob = async (req: Request, res: Response<dto.cancelJob.response | dto.cancelJob.error>) => {
  const jobId: number = res.locals.jobId;
  try {
    const job = await jobService.cancelJob(jobId);
    return res.status(200).json({ message: "Job cancelled", job: toJobView(job) });
  } catch (err) {
    return forwardServiceError(err, res, "Could not cancel job");
  }
};
