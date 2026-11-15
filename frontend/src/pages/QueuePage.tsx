import { useMemo, useState } from "react";
import JobTable from "../components/Queue/JobTable";
import QueueStats from "../components/Queue/QueueStats";
import type { Job } from "../interface/Job";
import { isActive } from "../interface/Job";
import { cn } from "../lib/utils";

type Filter = "all" | "active" | "done";

interface QueuePageProps {
  jobs: Job[];
  loaded: boolean;
  busyId: number | null;
  onOpen: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (job: Job) => void;
  onUpload: () => void;
}

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Running" },
  { key: "done", label: "Finished" },
];

const QueuePage = ({ jobs, loaded, busyId, onOpen, onCancel, onDelete, onUpload }: QueuePageProps) => {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    if (filter === "active") return jobs.filter(isActive);
    if (filter === "done") return jobs.filter((job) => !isActive(job));
    return jobs;
  }, [jobs, filter]);

  return (
    <div className="space-y-6">
      <QueueStats jobs={jobs} />

      <div className="flex gap-1 rounded-xl border border-line bg-panel p-1 sm:w-fit">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none",
              filter === key ? "bg-panel-2 text-ink" : "text-ink-dim hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loaded ? (
        <JobTable
          jobs={visible}
          busyId={busyId}
          emptyText={filter === "all" ? "No jobs yet." : "Nothing here right now."}
          onOpen={onOpen}
          onCancel={onCancel}
          onDelete={onDelete}
          onUpload={onUpload}
        />
      ) : (
        <div className="h-48 animate-pulse rounded-2xl border border-line bg-panel" />
      )}
    </div>
  );
};

export default QueuePage;
