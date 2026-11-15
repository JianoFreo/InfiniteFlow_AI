import { Clapperboard } from "lucide-react";
import type { Job } from "../../interface/Job";
import JobRow from "./JobTable/JobRow";

interface JobTableProps {
  jobs: Job[];
  busyId: number | null;
  emptyText: string;
  onOpen: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (job: Job) => void;
  onUpload: () => void;
}

const JobTable = ({ jobs, busyId, emptyText, onOpen, onCancel, onDelete, onUpload }: JobTableProps) => {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
        <Clapperboard className="size-8 text-ink-faint" />
        <p className="text-sm text-ink-dim">{emptyText}</p>
        <button onClick={onUpload} className="rounded-lg bg-flow px-3.5 py-2 text-sm font-semibold text-canvas hover:bg-flow-strong">
          Upload a video
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_1.2fr_1.6fr_0.9fr_auto] gap-x-4 border-b border-line px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-ink-faint md:grid">
        <span>Video</span>
        <span>Frame rate</span>
        <span>Progress</span>
        <span>Chunks</span>
        <span className="w-[136px] text-right">Actions</span>
      </div>
      <ul>
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} busy={busyId === job.id} onOpen={onOpen} onCancel={onCancel} onDelete={onDelete} />
        ))}
      </ul>
    </div>
  );
};

export default JobTable;
