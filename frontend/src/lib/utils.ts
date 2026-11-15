/** Joins class names, skipping falsy ones. */
export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export const formatBytes = (bytes: number | null | undefined) => {
  if (bytes == null) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

/** 83_400 → "1:23", 4_200 → "4.2 s" */
export const formatDuration = (ms: number | null | undefined) => {
  if (ms == null || Number.isNaN(ms)) return "-";
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

export const formatFps = (fps: number) => (Number.isInteger(fps) ? `${fps}` : fps.toFixed(2));

export const formatNumber = (value: number) => value.toLocaleString("en-US");

export const timeAgo = (iso: string, now = Date.now()) => {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
};

/** Stable color per engine replica name, so the chunk grid shows which replica did what. */
const WORKER_COLORS = ["#2dd4bf", "#a78bfa", "#f472b6", "#fbbf24", "#60a5fa", "#4ade80", "#fb923c", "#e879f9"];
export const workerColor = (worker: string | null) => {
  if (!worker) return "var(--color-line-strong)";
  let hash = 0;
  for (const char of worker) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return WORKER_COLORS[hash % WORKER_COLORS.length];
};
