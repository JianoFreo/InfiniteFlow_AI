import type { JobStatus } from "../interface/Job";
import { cn } from "../lib/utils";

const FILL: Record<JobStatus, string> = {
  queued: "bg-ink-faint",
  processing: "bg-flow",
  merging: "bg-pulse",
  completed: "bg-ok",
  failed: "bg-bad",
  cancelled: "bg-warn",
};

interface ProgressBarProps {
  value: number;
  status: JobStatus;
  size?: "sm" | "lg";
}

const ProgressBar = ({ value, status, size = "sm" }: ProgressBarProps) => {
  const active = status === "processing" || status === "merging";
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-line", size === "lg" ? "h-3" : "h-1.5")}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", FILL[status], active && "progress-active")}
        style={{ width: `${Math.max(status === "queued" ? 0 : 2, Math.min(100, value))}%` }}
      />
    </div>
  );
};

export default ProgressBar;
