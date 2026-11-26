import type { NextFunction, Request, Response } from "express";
import { ENV } from "../config/env.js";

/**
 * Guards the /internal routes. Only job-service knows the key, so a browser cannot fake a live update.
 * In Docker Compose, nginx does not forward /internal. On Render the BFF is public, so INTERNAL_KEY must be
 * a long random value.
 */
export const requireInternalKey = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers["x-internal-key"] !== ENV.INTERNAL_KEY) {
    return res.status(401).json({ message: "Not allowed" });
  }
  next();
};
