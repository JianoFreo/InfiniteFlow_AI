import { createApp } from "./app.js";
import { ENV } from "./config/env.js";
import { closeAllJobStreams } from "./services/job-sse/index.js";

const app = createApp();

const server = app.listen(ENV.PORT, () => {
  console.log(`[bff] listening on http://localhost:${ENV.PORT}`);
  console.log(`[bff] job-service=${ENV.JOB_SERVICE_URL} media-service=${ENV.MEDIA_SERVICE_URL}`);
});
// Uploads of large videos can take minutes; don't let Node cut them off.
server.requestTimeout = 0;

const shutdown = (signal: string) => {
  console.log(`[bff] ${signal} received, shutting down`);
  closeAllJobStreams();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
