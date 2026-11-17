import type { Chunk } from "../../interface/Job";
import { cn, formatDuration, workerColor } from "../../lib/utils";

/**
 * One cell per chunk. The fill shows how far each chunk is; the color shows WHICH engine replica
 * processed it. With 3 replicas you'll see 3 colors working at the same time: the parallelism, visible.
 */
const ChunkGrid = ({ chunks }: { chunks: Chunk[] }) => {
  const workers = [...new Set(chunks.map((chunk) => chunk.worker).filter((w): w is string => Boolean(w)))];

  return (
    <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Chunks</h2>
        <p className="text-xs text-ink-faint">
          {chunks.length} chunk{chunks.length === 1 ? "" : "s"} · {workers.length} engine replica{workers.length === 1 ? "" : "s"} used
        </p>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
        {chunks.map((chunk) => {
          const pct = chunk.frameCount > 0 ? Math.min(100, (chunk.framesDone / chunk.frameCount) * 100) : 0;
          const color = workerColor(chunk.worker);
          return (
            <div
              key={chunk.index}
              className={cn(
                "relative h-11 overflow-hidden rounded-md border bg-canvas",
                chunk.status === "failed" ? "border-bad" : "border-line",
              )}
              title={[
                `Chunk ${chunk.index}: frames ${chunk.startFrame}–${chunk.startFrame + chunk.frameCount - 1}`,
                `${chunk.status}${chunk.worker ? ` on ${chunk.worker}` : ""}`,
                chunk.durationMs != null ? `took ${formatDuration(chunk.durationMs)}` : "",
              ]
                .filter(Boolean)
                .join("\n")}
            >
              <div
                className={cn("absolute inset-y-0 left-0 transition-[width] duration-500", chunk.status === "processing" && "progress-active")}
                style={{ width: `${pct}%`, background: color, opacity: chunk.status === "completed" ? 0.85 : 0.6 }}
              />
              <span className="absolute inset-0 grid place-items-center text-[10px] text-ink mix-blend-difference">
                {chunk.index}
              </span>
            </div>
          );
        })}
      </div>

      {workers.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {workers.map((worker) => (
            <li key={worker} className="flex items-center gap-1.5 text-xs text-ink-dim">
              <span className="size-2.5 rounded-sm" style={{ background: workerColor(worker) }} />
              {worker}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ChunkGrid;
