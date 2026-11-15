import { CheckCircle2, Film, Loader, XCircle } from "lucide-react";
import type { Job } from "../../interface/Job";
import { isActive } from "../../interface/Job";
import { formatNumber } from "../../lib/utils";

const QueueStats = ({ jobs }: { jobs: Job[] }) => {
  const active = jobs.filter(isActive).length;
  const done = jobs.filter((job) => job.status === "completed");
  const failed = jobs.filter((job) => job.status === "failed").length;
  const framesCreated = done.reduce((sum, job) => sum + (job.output.frameCount - job.source.frameCount), 0);

  const tiles = [
    { label: "Running", value: formatNumber(active), icon: Loader, tone: "text-flow" },
    { label: "Completed", value: formatNumber(done.length), icon: CheckCircle2, tone: "text-ok" },
    { label: "Failed", value: formatNumber(failed), icon: XCircle, tone: "text-bad" },
    { label: "Frames generated", value: formatNumber(framesCreated), icon: Film, tone: "text-pulse" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <Icon className={`size-4 ${tone}`} />
            {label}
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
};

export default QueueStats;
