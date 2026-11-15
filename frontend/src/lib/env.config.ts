/**
 * API base URL, same rules as TechCare:
 *  - `vite dev`: "" → relative URLs, the Vite proxy forwards /api to the BFF
 *  - build: VITE_API_BASE_URL (trailing "/" and "/api" stripped); empty = same origin (nginx proxies /api)
 */
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export const API_BASE_URL = import.meta.env.DEV ? "" : raw.replace(/\/+$/, "").replace(/\/api$/, "");
