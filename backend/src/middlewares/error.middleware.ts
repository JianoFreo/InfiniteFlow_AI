import type { NextFunction, Request, Response } from "express";

/** Unknown /api routes get a JSON 404 (TechCare's SPA fallback answered them with index.html + 200). */
export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[bff] unhandled error", err);
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(500).json({ message: "Internal server error" });
};
