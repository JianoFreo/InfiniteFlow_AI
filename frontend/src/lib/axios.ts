import axios, { isAxiosError } from "axios";
import { API_BASE_URL } from "./env.config";
import { authHeaders, clearSession, getToken } from "./identity";

/** The only HTTP client the app uses. It only ever talks to the BFF. */
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 });

api.interceptors.request.use((config) => {
  for (const [name, value] of Object.entries(authHeaders())) config.headers.set(name, value);
  return config;
});

/** A rejected token (expired, or the secret changed) drops back to guest mode instead of leaving the app stuck. */
api.interceptors.response.use(undefined, (err: unknown) => {
  if (isAxiosError(err) && err.response?.status === 401 && getToken()) {
    clearSession();
    window.dispatchEvent(new Event("auth-expired"));
  }
  return Promise.reject(err);
});

/** Pulls the BFF's { message } out of an error, whatever went wrong. */
export const errorMessage = (err: unknown, fallback = "Something went wrong") => {
  if (isAxiosError(err)) {
    const message = (err.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === "string") return message;
    if (!err.response) return "Can't reach the server";
  }
  return fallback;
};

/** Plan-limit errors carry a code: "too_many_running" | "plan_limit" | "quota_exceeded". */
export const errorCode = (err: unknown): string | null => {
  if (!isAxiosError(err)) return null;
  const code = (err.response?.data as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : null;
};

export const apiUrl =(path: string) => `${API_BASE_URL}${path}`;
