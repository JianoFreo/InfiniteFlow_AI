import type { Job } from "../../../interface/Job";
import { formatFps, timeAgo } from "../../../lib/utils";
import ProgressBar from "../../ProgressBar";
import StatusBadge from "../../StatusBadge";
import JobActions from "./JobActions";

interface JobRowProps {
  job: Job;
  busy: boolean;
  onOpen: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (job: Job) => void;
}

/** A grid row on desktop, a stacked card on phones. */
const JobRow = ({ job, busy, onOpen, onCancel, onDelete }: JobRowProps) => (
  <li className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,2.2fr)_1.2fr_1.6fr_0.9fr_auto] md:items-center">
    <button className="min-w-0 text-left" onClick={() => onOpen(job.id)}>
      <p className="truncate text-sm font-medium hover:text-flow">{job.source.fileName}</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        #{job.id} · {job.source.width}×{job.source.height} · {timeAgo(job.timing.createdAt)}
      </p>
    </button>

    <div className="order-last col-span-2 flex items-center gap-2 font-mono text-xs text-ink-dim md:order-none md:col-span-1">
      <span>{formatFps(job.source.fps)}</span>
      <span className="text-ink-faint">→</span>
      <span className="text-ink">{formatFps(job.output.fps)} fps</span>
      <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] text-flow">{job.factor}×</span>
    </div>

    <div className="col-span-2 md:col-span-1">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <StatusBadge status={job.status} />
        <span className="font-mono text-ink-dim">{job.progress}%</span>
      </div>
      <ProgressBar value={job.progress} status={job.status} />
    </div>

    <p className="hidden font-mono text-xs text-ink-dim md:block">
      {job.chunks.completed}/{job.chunks.total} chunks
    </p>

    <div className="col-start-2 row-start-1 md:col-start-auto md:row-start-auto">
      <JobActions job={job} busy={busy} onOpen={onOpen} onCancel={onCancel} onDelete={onDelete} />
    </div>
  </li>
);

export default JobRow;
