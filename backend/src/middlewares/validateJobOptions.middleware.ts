import type { NextFunction, Request, Response } from "express";

export interface JobOptions {
  factor: number;
  mode: "flow" | "blend";
  /** Comma-separated clean-up steps, or undefined for none. */
  preprocess?: string;
}

export const PREPROCESS_STEPS = ["denoise", "deband", "sharpen"] as const;

/**
 * Validates ?factor and ?mode BEFORE the upload starts streaming, so a bad request fails in
 * milliseconds instead of after uploading a whole video. Puts the parsed values on res.locals.jobOptions.
 */
export const validateJobOptions = (req: Request, res: Response, next: NextFunction) => {
  const factor = Number(req.query.factor ?? 2);
  const mode = String(req.query.mode ?? "flow");

  if (!Number.isInteger(factor) || factor < 2 || factor > 8) {
    return res.status(400).json({ message: "factor must be a whole number from 2 to 8" });
  }
  if (mode !== "flow" && mode !== "blend") {
    return res.status(400).json({ message: "mode must be 'flow' or 'blend'" });
  }

  const steps = String(req.query.preprocess ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const invalid = steps.filter((s) => !(PREPROCESS_STEPS as readonly string[]).includes(s));
  if (invalid.length > 0) {
    return res.status(400).json({ message: `preprocess must be a comma-separated list of: ${PREPROCESS_STEPS.join(", ")}` });
  }
  const preprocess = [...new Set(steps)].join(",") || undefined;

  res.locals.jobOptions = { factor, mode, preprocess } satisfies JobOptions;
  next();
};

/** Rejects non-numeric :job_id params with 400 instead of passing them to the services. */
export const validateJobId = (req: Request, res: Response, next: NextFunction) => {
  const jobId = Number(req.params.job_id);
  if (!Number.isInteger(jobId) || jobId < 1) {
    return res.status(400).json({ message: "job_id must be a positive integer" });
  }
  res.locals.jobId = jobId;
  next();
};
