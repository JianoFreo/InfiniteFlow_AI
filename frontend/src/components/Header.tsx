import { Menu, RotateCw } from "lucide-react";
import type { StreamState } from "../services/job-sse/connectJobStream";
import { cn } from "../lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  streamState: StreamState;
  onMenu: () => void;
  onReload: () => void;
  reloading: boolean;
}

const STREAM_LABEL: Record<StreamState, string> = {
  live: "Live",
  connecting: "Connecting",
  offline: "Reconnecting",
};

const Header = ({ title, subtitle, streamState, onMenu, onReload, reloading }: HeaderProps) => (
  <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-6">
    <button className="rounded-lg p-2 text-ink-dim hover:bg-panel-2 lg:hidden" onClick={onMenu} aria-label="Open menu">
      <Menu className="size-5" />
    </button>
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="truncate text-xs text-ink-faint">{subtitle}</p>}
    </div>
    <span
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        streamState === "live" ? "border-ok/30 text-ok" : "border-warn/30 text-warn",
      )}
      title="Live updates over Server-Sent Events"
    >
      <span className="relative flex size-2">
        {streamState === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />}
        <span className={cn("relative inline-flex size-2 rounded-full", streamState === "live" ? "bg-ok" : "bg-warn")} />
      </span>
      {STREAM_LABEL[streamState]}
    </span>
    <button
      onClick={onReload}
      className="rounded-lg p-2 text-ink-dim hover:bg-panel-2 hover:text-ink"
      aria-label="Reload"
      title="Reload"
    >
      <RotateCw className={cn("size-4.5", reloading && "animate-spin")} />
    </button>
  </header>
);

export default Header;
