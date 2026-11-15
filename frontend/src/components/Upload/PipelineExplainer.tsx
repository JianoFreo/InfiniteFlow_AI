import { Boxes, Combine, Cpu, FileSearch, Server } from "lucide-react";

const STEPS = [
  {
    icon: Server,
    who: "BFF",
    text: "Receives your upload and streams it straight through. The browser only ever talks to the BFF.",
  },
  {
    icon: FileSearch,
    who: "media-service",
    text: "Stores the file and reads its fps, frame count, size and audio with ffprobe.",
  },
  {
    icon: Boxes,
    who: "job-service",
    text: "Cuts the video into ~2 s chunks and puts one task per chunk on RabbitMQ.",
  },
  {
    icon: Cpu,
    who: "interpolation-engine × N",
    text: "Every replica grabs a chunk, computes optical flow and writes the new frames. More replicas = faster.",
  },
  {
    icon: Combine,
    who: "media-service",
    text: "Joins the chunks back together (no re-encode) and puts your audio back.",
  },
];

const PipelineExplainer = () => (
  <aside className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
    <h2 className="text-sm font-semibold">What happens after you click</h2>
    <ol className="mt-4 space-y-4">
      {STEPS.map(({ icon: Icon, who, text }, index) => (
        <li key={index} className="flex gap-3">
          <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-panel-2 text-flow">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="font-mono text-xs text-flow">{who}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-dim">{text}</p>
          </div>
        </li>
      ))}
    </ol>
    <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
      Progress comes back over RabbitMQ to job-service, then to the BFF, which pushes it to this page
      over Server-Sent Events. No polling.
    </p>
  </aside>
);

export default PipelineExplainer;
