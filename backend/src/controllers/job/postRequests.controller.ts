import type { Request, Response } from "express";
import { jobService } from "../../clients/jobService.client.js";
import { mediaService } from "../../clients/mediaService.client.js";
import type { Identity } from "../../middlewares/identity.middleware.js";
import type { JobOptions } from "../../middlewares/validateJobOptions.middleware.js";
import { forwardServiceError } from "../../utils/forwardServiceError.js";
import { toJobView } from "../../utils/toJobView.js";
import type * as dto from "./dto/post.dto.js";

/**
 * Upload + create job in one call for the browser, two calls behind it:
 *   1. stream the file to media-service  → it stores and probes it (fps, frames, size)
 *   2. ask job-service to create the job → it plans chunks and queues them for the engines
 * If step 2 fails, the file from step 1 is deleted so nothing is left orphaned.
 */
export const addJob = async (
  req: Request<unknown, unknown, unknown, dto.addJob.query>,
  res: Response<dto.addJob.response | dto.addJob.error>,
) => {
  const { factor, mode, preprocess }: JobOptions = res.locals.jobOptions;
  const identity: Identity = res.locals.identity;
  const contentType = req.headers["content-type"];
  if (!contentType?.startsWith("multipart/form-data")) {
    return res.status(400).json({ message: "Upload the video as multipart/form-data with a 'file' field" });
  }

  let mediaId: number;
  try {
    const media = await mediaService.uploadStream(req, contentType, req.headers["content-length"]);
    mediaId = media.id;
  } catch (err) {
    return forwardServiceError(err, res, "Upload failed");
  }

  try {
    const job = await jobService.createJob({ sourceMediaId: mediaId, factor, mode, preprocess, ownerId: identity.owner });
    return res.status(201).json({ message: "Job created", job: toJobView(job) });
  } catch (err) {
    await mediaService.deleteMedia(mediaId).catch(() => undefined);
    return forwardServiceError(err, res, "Could not create job");
  }
};
