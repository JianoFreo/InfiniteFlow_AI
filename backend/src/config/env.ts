import dotenv from "dotenv";

dotenv.config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env", quiet: true });

export const ENV = {
  PORT: Number(process.env.PORT ?? 5000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // Signs login tokens. MUST be set to a long random value in production.
  AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-only-secret-change-me",
  JOB_SERVICE_URL: process.env.JOB_SERVICE_URL ?? "http://localhost:8081",
  MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL ?? "http://localhost:8082",
  // Shared by all three services. The BFF sends it to job-service and media-service, and job-service sends it
  // with every live update. Anything without it is rejected.
  INTERNAL_KEY: process.env.INTERNAL_KEY ?? "dev-internal-key",
  // How long to wait for a service. Raise both on free hosting, where a sleeping service takes minutes to wake.
  SERVICE_TIMEOUT_MS: Number(process.env.SERVICE_TIMEOUT_MS ?? 15_000),
  HEALTH_TIMEOUT_MS: Number(process.env.HEALTH_TIMEOUT_MS ?? 3_000),
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

// Render sets RENDER=true. Never run the public site with the secrets that are written in this file.
if (process.env.RENDER === "true") {
  for (const key of ["AUTH_SECRET", "INTERNAL_KEY"]) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
  }
}
