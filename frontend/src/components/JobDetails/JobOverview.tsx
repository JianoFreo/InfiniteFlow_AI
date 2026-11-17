import { useEffect, useState } from "react";
import type { JobDetail } from "../../interface/Job";
import { isActive } from "../../interface/Job";
import { formatDuration, formatFps, formatNumber } from "../../lib/utils";
import ProgressBar from "../ProgressBar";
import StatusBadge from "../StatusBadge";
import StatTile from "./JobOverview/StatTile";

const STAGE_TEXT: Record<JobDetail["status"], string> = {
  queued: "Waiting for a free engine",
  processing: "Engines are generating frames",
  merging: "Joining chunks and restoring audio",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Ticks once a second while the job runs, so the elapsed time moves without any request. */
const useNow = (enabled: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
};

const JobOverview = ({ job }: { job: JobDetail }) => {
  const running = isActive(job);
  const now = useNow(running);

  const start = Date.parse(job.timing.createdAt);
  const end = job.timing.finishedAt ? Date.parse(job.timing.finishedAt) : now;
  const elapsedMs = Math.max(0, end - start);

  const framesDone = job.chunkList.reduce((sum, chunk) => sum + chunk.framesDone, 0);
  const processingStart = job.timing.startedAt ? Date.parse(job.timing.startedAt) : NaN;
  const processingSeconds = (end - processingStart) / 1000;
  const speed = processingSeconds > 0 && framesDone > 0 ? framesDone / processingSeconds : null;
  const realtime = speed != null ? speed / job.source.fps : null;

  return (
    <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={job.status} />
        <p className="text-sm text-ink-dim">{STAGE_TEXT[job.status]}</p>
        <span className="ml-auto text-2xl font-semibold">{job.progress}%</span>
      </div>
      <div className="mt-3">
        <ProgressBar value={job.progress} status={job.status} size="lg" />
      </div>
      {job.error && job.status === "failed" && (
        <p className="mt-3 rounded-lg border border-bad/30 bg-bad/8 px-3 py-2 text-sm text-bad">{job.error}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Source"
          value={`${formatFps(job.source.fps)} fps`}
          detail={`${job.source.width}×${job.source.height} · ${formatNumber(job.source.frameCount)} frames`}
        />
        <StatTile
          label="Output"
          value={`${formatFps(job.output.fps)} fps`}
          detail={`${formatNumber(job.output.frameCount)} frames · ${job.mode === "flow" ? "optical flow" : "blend"}${job.preprocess.length ? ` · ${job.preprocess.join(" + ")}` : ""}`}
        />
        <StatTile
          label="Speed"
          value={speed != null ? `${speed.toFixed(1)} fr/s` : "-"}
          detail={realtime != null ? `${realtime.toFixed(2)}× real time` : "source frames per second"}
        />
        <StatTile
          label={running ? "Elapsed" : "Total time"}
          value={formatDuration(elapsedMs)}
          detail={`video length ${formatDuration(job.source.durationMs)}`}
        />
      </div>
    </section>
  );
};

export default JobOverview;
