import type { JobStatus } from "../interface/Job";
import { cn } from "../lib/utils";

const STYLES: Record<JobStatus, string> = {
  queued: "bg-ink-faint/15 text-ink-dim",
  processing: "bg-flow/15 text-flow",
  merging: "bg-pulse/15 text-pulse",
  completed: "bg-ok/15 text-ok",
  failed: "bg-bad/15 text-bad",
  cancelled: "bg-warn/15 text-warn",
};

const StatusBadge = ({ status }: { status: JobStatus }) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STYLES[status])}>
    {(status === "processing" || status === "merging") && (
      <span className="size-1.5 animate-pulse rounded-full bg-current" />
    )}
    {status}
  </span>
);

export default StatusBadge;
