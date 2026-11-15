import type { Request, Response } from "express";
import { jobService } from "../../clients/jobService.client.js";
import { forwardServiceError } from "../../utils/forwardServiceError.js";
import type * as dto from "./dto/delete.dto.js";

export const deleteJob = async (req: Request, res: Response<dto.deleteJob.response | dto.deleteJob.error>) => {
  const jobId: number = res.locals.jobId;
  try {
    await jobService.deleteJob(jobId);
    return res.status(200).json({ message: "Job deleted", job_id: jobId });
  } catch (err) {
    return forwardServiceError(err, res, "Could not delete job");
  }
};
