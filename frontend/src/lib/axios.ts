import axios, { isAxiosError } from "axios";
import { API_BASE_URL } from "./env.config";

/** The only HTTP client the app uses. It only ever talks to the BFF. */
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 });

/** Pulls the BFF's { message } out of an error, whatever went wrong. */
export const errorMessage = (err: unknown, fallback = "Something went wrong") => {
  if (isAxiosError(err)) {
    const message = (err.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === "string") return message;
    if (!err.response) return "Can't reach the server";
  }
  return fallback;
};

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
