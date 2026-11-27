import type { Request, Response } from "express";
import { jobService } from "../../clients/jobService.client.js";
import { mediaService } from "../../clients/mediaService.client.js";
import type { Identity } from "../../middlewares/identity.middleware.js";
import type { JobOptions } from "../../middlewares/validateJobOptions.middleware.js";
import { clientKey } from "../../utils/clientKey.js";
import { forwardServiceError } from "../../utils/forwardServiceError.js";
import { toJobView } from "../../utils/toJobView.js";
import type * as dto from "./dto/post.dto.js";

const NEXT_PLAN = { guest: "Sign up free for more.", free: "Upgrade to Pro for more.", pro: "" } as const;

/**
 * Upload + create job in one call for the browser, three calls behind it:
 *   0. ask job-service for the caller's usage → refuse straight away when the plan can't take this request,
 *      so nobody uploads a big file only to be told no
 *   1. stream the file to media-service  → it stores and probes it (fps, frames, size)
 *   2. ask job-service to create the job → it checks the clip length and the daily allowance, plans chunks
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
  const key = clientKey(req);

  try {
    const usage = await jobService.usage(identity.owner, key);
    const more = NEXT_PLAN[usage.plan];
    if (usage.activeJobs >= usage.limits.maxActive) {
      return res.status(409).json({
        code: "too_many_running",
        message: `${usage.limits.maxActive === 1 ? "You already have a video processing" : `You already have ${usage.limits.maxActive} videos processing`}. Wait for it to finish. ${more}`.trim(),
      });
    }
    if (factor > usage.limits.maxFactor) {
      return res.status(403).json({ code: "plan_limit", message: `Your plan goes up to ${usage.limits.maxFactor}x. ${more}`.trim() });
    }
    if (usage.remainingSeconds <= 0) {
      return res.status(429).json({ code: "quota_exceeded", message: `You've used today's allowance. ${more}`.trim() });
    }
  } catch (err) {
    return forwardServiceError(err, res, "Could not check your plan");
  }

  let mediaId: number;
  try {
    const media = await mediaService.uploadStream(req, contentType, req.headers["content-length"]);
    mediaId = media.id;
  } catch (err) {
    return forwardServiceError(err, res, "Upload failed");
  }

  try {
    const job = await jobService.createJob({ sourceMediaId: mediaId, factor, mode, preprocess, ownerId: identity.owner, clientKey: key });
    return res.status(201).json({ message: "Job created", job: toJobView(job) });
  } catch (err) {
    await mediaService.deleteMedia(mediaId).catch(() => undefined);
    return forwardServiceError(err, res, "Could not create job");
  }
};
