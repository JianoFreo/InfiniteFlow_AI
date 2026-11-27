import cors from "cors";
import express from "express";
import { ENV } from "./config/env.js";
import { stripeWebhook } from "./controllers/billing/postRequests.controller.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import authRouter from "./routes/auth.route.js";
import billingRouter from "./routes/billing.route.js";
import usageRouter from "./routes/usage.route.js";
import healthRouter from "./routes/health.route.js";
import internalRouter from "./routes/internal.route.js";
import jobRouter from "./routes/job.route.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", ENV.TRUST_PROXY); // req.ip = the visitor, not nginx
  app.use(cors({ origin: ENV.CORS_ORIGIN }));
  // Stripe signs the exact bytes it sends, so this one route gets the raw body (before the JSON parser).
  app.post("/api/billing/webhook", express.raw({ type: "application/json", limit: "1mb" }), stripeWebhook);
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
  app.use("/api/usage", usageRouter);
  app.use("/api/billing", billingRouter);

  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
};
