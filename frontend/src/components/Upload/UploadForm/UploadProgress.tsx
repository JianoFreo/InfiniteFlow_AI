import { formatBytes } from "../../../lib/utils";

interface UploadProgressProps {
  loaded: number;
  total: number;
  bytesPerSecond: number;
}

const UploadProgress = ({ loaded, total, bytesPerSecond }: UploadProgressProps) => {
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
  const finishing = percent >= 100;
  return (
    <div className="rounded-xl border border-line bg-canvas p-3.5">
      <div className="flex justify-between text-xs">
        <span className="text-ink-dim">
          {finishing ? "Reading video info (fps, frames)…" : `Uploading ${formatBytes(loaded)} of ${formatBytes(total)}`}
        </span>
        <span className="font-mono text-ink">{finishing ? "" : `${formatBytes(bytesPerSecond)}/s · ${percent}%`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="progress-active h-full rounded-full bg-flow transition-[width] duration-300"
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
    </div>
  );
};

export default UploadProgress;
