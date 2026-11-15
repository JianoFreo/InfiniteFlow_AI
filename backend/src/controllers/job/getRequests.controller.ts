import type { Request, Response } from "express";
import { jobService } from "../../clients/jobService.client.js";
import { mediaService } from "../../clients/mediaService.client.js";
import { forwardServiceError } from "../../utils/forwardServiceError.js";
import { outputFileName, toJobDetailView, toJobView } from "../../utils/toJobView.js";
import type * as dto from "./dto/get.dto.js";

export const getJobs = async (
  req: Request<unknown, unknown, unknown, dto.getJobs.query>,
  res: Response<dto.getJobs.response | dto.getJobs.error>,
) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
  const activeOnly = req.query.activeOnly === "true";
  try {
    const jobs = await jobService.listJobs(limit, activeOnly);
    return res.status(200).json({ message: "Jobs retrieved", jobs: jobs.map(toJobView) });
  } catch (err) {
    return forwardServiceError(err, res, "Could not load jobs");
  }
};

/** One browser request, two job-service calls in parallel, one merged response: classic BFF aggregation. */
export const getJob = async (req: Request, res: Response<dto.getJob.response | dto.getJob.error>) => {
  const jobId: number = res.locals.jobId;
  try {
    const [job, chunks] = await Promise.all([jobService.getJob(jobId), jobService.getChunks(jobId)]);
    return res.status(200).json({ message: "Job retrieved", job: toJobDetailView(job, chunks) });
  } catch (err) {
    return forwardServiceError(err, res, "Could not load job");
  }
};

const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

export const downloadJob = async (req: Request, res: Response<dto.downloadJob.error>) => {
  const jobId: number = res.locals.jobId;
  try {
    const job = await jobService.getJob(jobId);
    if (job.status !== "COMPLETED" || job.outputMediaId == null) {
      return res.status(409).json({ message: "The video is not ready yet" });
    }

    const upstream = await mediaService.streamContent(job.outputMediaId, req.headers.range);
    if (upstream.status >= 400) {
      upstream.data.resume();
      return res.status(upstream.status === 416 ? 416 : 404).json({ message: "Output file is missing" });
    }

    res.status(upstream.status);
    for (const header of PASSTHROUGH_HEADERS) {
      const value = upstream.headers[header];
      if (value != null) res.setHeader(header, String(value));
    }
    const disposition = req.query.attachment ? "attachment" : "inline";
    res.setHeader("content-disposition", `${disposition}; filename="${outputFileName(job).replace(/"/g, "")}"`);

    req.on("close", () => upstream.data.destroy()); // viewer closed the tab or seeked: stop reading the file
    upstream.data.pipe(res);
  } catch (err) {
    return forwardServiceError(err, res, "Could not download video");
  }
};
