import dotenv from "dotenv";

dotenv.config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env", quiet: true });

export const ENV = {
  PORT: Number(process.env.PORT ?? 5000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // Signs login tokens. MUST be set to a long random value in production.
  AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-only-secret-change-me",
  JOB_SERVICE_URL: process.env.JOB_SERVICE_URL ?? "http://localhost:8081",
  MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL ?? "http://localhost:8082",
  RABBITMQ_URL: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
