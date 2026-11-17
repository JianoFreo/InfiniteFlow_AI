import type { Request, Response } from "express";
import { publishJobChange } from "../../services/job-sse/index.js";
import type * as dto from "./dto/post.dto.js";

/**
 * job-service tells us a job changed; we hand it to the SSE hub, which pushes it to the right browsers.
 * Same idea as TechCare's publishQueueChange(), except the change happens in another service.
 */
export const receiveJobEvents = (req: Request, res: Response<dto.receiveJobEvents.response | dto.receiveJobEvents.error>) => {
  const events = req.body as dto.receiveJobEvents.body;
  if (!Array.isArray(events)) {
    return res.status(400).json({ message: "Expected an array of job events" });
  }

  let received = 0;
  for (const event of events) {
    if (typeof event?.jobId !== "number" || typeof event.status !== "string" || typeof event.ownerId !== "string") continue;
    publishJobChange({
      id: event.jobId,
      status: event.status.toLowerCase(),
      progress: event.progress ?? 0,
      completedChunks: event.completedChunks ?? 0,
      totalChunks: event.totalChunks ?? 0,
      ownerId: event.ownerId,
    });
    received += 1;
  }
  return res.status(200).json({ message: "Events received", received });
};
