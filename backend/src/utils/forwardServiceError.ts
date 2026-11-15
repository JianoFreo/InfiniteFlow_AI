import type { Response } from "express";
import { isAxiosError } from "axios";

/**
 * Turns a failed call to a microservice into a clean { message } response for the browser.
 *  - 4xx from a service: passed through (it's the client's mistake: bad id, bad file...)
 *  - 5xx from a service: 502 Bad Gateway (the BFF is fine, something behind it isn't)
 *  - service unreachable: 503
 */
export const forwardServiceError = (err: unknown, res: Response, fallback: string) => {
  if (isAxiosError(err)) {
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data as { message?: string } | undefined;
      const message = typeof data?.message === "string" ? data.message : fallback;
      return res.status(status >= 500 ? 502 : status).json({ message });
    }
    const service = err.config?.baseURL ?? "a service";
    console.error(`[bff] ${fallback}: ${service} unreachable (${err.code ?? err.message})`);
    return res.status(503).json({ message: `${fallback}: service unavailable` });
  }
  console.error(`[bff] ${fallback}:`, err);
  return res.status(500).json({ message: fallback });
};
