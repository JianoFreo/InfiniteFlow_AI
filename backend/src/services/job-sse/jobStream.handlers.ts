import type { Request, Response } from "express";
import { addScreen, hasCapacity, removeScreen } from "./jobStream.hub.js";

/** GET /api/jobs/stream */
export const streamJobs = (req: Request, res: Response) => {
  if (!hasCapacity()) {
    return res.status(503).json({ message: "Too many live screens connected" });
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // tells nginx not to buffer this response
  res.flushHeaders();

  res.write("retry: 3000\n\n");
  res.write(`event: ready\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
  addScreen(res);

  req.on("close", () => removeScreen(res));
};
