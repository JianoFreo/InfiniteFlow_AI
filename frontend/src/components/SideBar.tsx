import { ChevronLeft, Infinity as InfinityIcon, Plus, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Job } from "../interface/Job";
import { isActive } from "../interface/Job";
import { cn, timeAgo } from "../lib/utils";

interface SideBarProps {
  jobs: Job[];
  loaded: boolean;
  activeJobId: number | null;
  onNewVideo: () => void;
  onOpenJob: (id: number) => void;
  onDeleteJob: (job: Job) => void;
  open: boolean;
  onClose: () => void;
  live: boolean;
  collapsed: boolean;
  onCollapse: () => void;
  footer?: ReactNode;
}

const DOT: Record<Job["status"], string> = {
  queued: "bg-ink-faint",
  processing: "bg-flow animate-pulse",
  merging: "bg-flow animate-pulse",
  completed: "bg-ok",
  failed: "bg-bad",
  cancelled: "bg-warn",
};

/** ChatGPT-style: new-item button on top, history of past works below. */
const SideBar = ({ jobs, loaded, activeJobId, onNewVideo, onOpenJob, onDeleteJob, open, onClose, live, collapsed, onCollapse, footer }: SideBarProps) => (
  <>
    {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} aria-hidden />}
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-panel transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        collapsed && "lg:hidden",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <InfinityIcon className="size-5" strokeWidth={1.75} />
          <span className="font-semibold tracking-tight">InfiniteFlow</span>
          {!live && <span className="size-2 rounded-full bg-warn" title="Reconnecting…" />}
        </div>
        <button className="rounded-lg p-1.5 text-ink-dim hover:bg-panel-2 lg:hidden" onClick={onClose} aria-label="Close menu">
          <X className="size-5" />
        </button>
        <button
          className="hidden rounded-lg p-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink lg:block"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={onNewVideo}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-panel-2",
            activeJobId == null && "bg-panel-2",
          )}
        >
          <Plus className="size-4" strokeWidth={2} />
          New video
        </button>
      </div>

      <p className="px-5 pb-1 text-xs font-medium text-ink-faint">Your videos</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {loaded && jobs.length === 0 && <p className="px-2 py-3 text-sm text-ink-faint">No videos yet.</p>}
        {jobs.map((job) => (
          <div
            key={job.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg transition-colors hover:bg-panel-2",
              job.id === activeJobId && "bg-panel-2",
            )}
          >
            <button onClick={() => onOpenJob(job.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left">
              <span className={cn("size-2 shrink-0 rounded-full", DOT[job.status])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{job.source.fileName}</span>
                <span className="block text-xs text-ink-faint">
                  {isActive(job) ? `${job.progress}% · ${job.factor}×` : `${job.factor}× · ${timeAgo(job.timing.createdAt)}`}
                </span>
              </span>
            </button>
            <button
              onClick={() => onDeleteJob(job)}
              className="mr-1.5 rounded-md p-1.5 text-ink-faint opacity-0 hover:text-bad focus:opacity-100 group-hover:opacity-100"
              aria-label={`Delete ${job.source.fileName}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </nav>
      {footer}
    </aside>
  </>
);

export default SideBar;
