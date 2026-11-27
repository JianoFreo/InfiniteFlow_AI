import dotenv from "dotenv";

dotenv.config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env", quiet: true });

const optional = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

export const ENV = {
  PORT: Number(process.env.PORT ?? 5000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // Signs login tokens (and hashes client IPs). MUST be set to a long random value in production.
  AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-only-secret-change-me",
  JOB_SERVICE_URL: process.env.JOB_SERVICE_URL ?? "http://localhost:8081",
  MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL ?? "http://localhost:8082",
  // Shared with job-service. It sends this with every live update; anything without it is rejected.
  INTERNAL_KEY: process.env.INTERNAL_KEY ?? "dev-internal-key",
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Which proxies may set X-Forwarded-For. The default trusts the Docker network (Caddy -> nginx -> BFF),
  // so req.ip is the visitor's real address. Guests are rate limited by it.
  TRUST_PROXY: process.env.TRUST_PROXY ?? "loopback, linklocal, uniquelocal",

  // Stripe. Leave these empty and billing is simply off (everyone is guest or free).
  STRIPE_SECRET_KEY: optional(process.env.STRIPE_SECRET_KEY),
  STRIPE_WEBHOOK_SECRET: optional(process.env.STRIPE_WEBHOOK_SECRET),
  /** The monthly Price of the Pro plan (price_...), created in the Stripe dashboard. */
  STRIPE_PRICE_PRO: optional(process.env.STRIPE_PRICE_PRO),
  /** What the Pro card says. Display only: Stripe charges whatever the Price above says. */
  PRO_PRICE_LABEL: optional(process.env.PRO_PRICE_LABEL) ?? "$9 / month",
  /** Public address of the site, where Stripe sends people back after checkout. */
  APP_URL: (process.env.APP_URL ?? "http://localhost:8080").replace(/\/+$/, ""),
};
