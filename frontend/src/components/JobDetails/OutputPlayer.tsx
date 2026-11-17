import { Download } from "lucide-react";
import type { Job } from "../../interface/Job";
import { apiUrl } from "../../lib/axios";
import { formatBytes, formatFps } from "../../lib/utils";

/** Plays the result straight from the BFF download route; Range requests make seeking work. */
const OutputPlayer = ({ job }: { job: Job }) => {
  if (!job.output.downloadUrl) return null;
  const src = apiUrl(job.output.downloadUrl);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <video src={src} controls playsInline loop className="aspect-video w-full bg-black object-contain" />
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Result at {formatFps(job.output.fps)} fps</p>
          <p className="text-xs text-ink-faint">
            {formatBytes(job.output.sizeBytes)} · {job.source.hasAudio ? "original audio kept" : "no audio track"}
          </p>
        </div>
        <a
          href={`${src}?attachment=1`}
          className="flex items-center gap-2 rounded-lg bg-flow px-3.5 py-2 text-sm font-medium text-canvas hover:bg-flow-strong"
        >
          <Download className="size-4" />
          Download
        </a>
      </div>
    </section>
  );
};

export default OutputPlayer;
