import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { ENV } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import authRouter from "./routes/auth.route.js";
import healthRouter from "./routes/health.route.js";
import internalRouter from "./routes/internal.route.js";
import jobRouter from "./routes/job.route.js";

// Works from both backend/src and backend/dist
const frontendPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: ENV.CORS_ORIGIN }));
  // JSON only. Multipart uploads are NOT parsed here: they are streamed through to media-service.
  app.use(express.json({ limit: "1mb" }));

  if (ENV.NODE_ENV !== "test") {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => {
        if (req.path !== "/api/jobs/stream") {
          console.log(`[bff] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
        }
      });
      next();
    });
  }

  app.use("/api/health", healthRouter);
  app.use("/internal", internalRouter); // job-service only, see requireInternalKey
  app.use("/api/auth", authRouter);
  app.use("/api/jobs", jobRouter);

  app.use("/api", notFound);

  // Deployment (like TechCare): after `npm run build`, this server also serves the React app.
  // In `npm run dev` and Docker Compose, Vite or nginx serves it instead.
  if (ENV.NODE_ENV === "production" && existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    // React Router: any other page request loads the app. /internal is never a page.
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/internal")) return next();
      res.sendFile(path.join(frontendPath, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
};
