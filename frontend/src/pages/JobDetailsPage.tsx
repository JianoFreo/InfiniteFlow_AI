import { Ban, Trash2 } from "lucide-react";
import ChunkGrid from "../components/JobDetails/ChunkGrid";
import JobOverview from "../components/JobDetails/JobOverview";
import OutputPlayer from "../components/JobDetails/OutputPlayer";
import type { Job, JobDetail } from "../interface/Job";
import { isActive } from "../interface/Job";

interface JobDetailsPageProps {
  job: JobDetail | null;
  error: string | null;
  busy: boolean;
  onCancel: (id: number) => void;
  onDelete: (job: Job) => void;
}

const JobDetailsPage = ({ job, error, busy, onCancel, onDelete }: JobDetailsPageProps) => {
  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-bad/30 bg-bad/8 p-5 text-sm text-bad">{error}</p>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-panel" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{job.source.fileName}</h1>
          <p className="text-sm text-ink-faint">Job #{job.id} · {job.factor}× · {job.mode}</p>
        </div>
        <div className="flex gap-2">
          {isActive(job) && (
            <button
              onClick={() => onCancel(job.id)}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-dim hover:border-warn/50 hover:text-warn disabled:opacity-50"
            >
              <Ban className="size-4" /> Cancel
            </button>
          )}
          <button
            onClick={() => onDelete(job)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-dim hover:border-bad/50 hover:text-bad disabled:opacity-50"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </div>
      </div>

      <JobOverview job={job} />
      {job.status === "completed" && <OutputPlayer job={job} />}
      <ChunkGrid chunks={job.chunkList} />
    </div>
  );
};

export default JobDetailsPage;
