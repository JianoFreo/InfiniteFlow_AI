import { Infinity as InfinityIcon, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

export interface NavItem {
  page: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export type ServiceHealth = Record<string, "UP" | "DOWN"> | null;

interface SideBarProps {
  navItems: NavItem[];
  activePage: string;
  onNavigate: (page: string) => void;
  open: boolean;
  onClose: () => void;
  health: ServiceHealth;
}

const SERVICE_LABELS: Record<string, string> = {
  bff: "BFF (Express)",
  jobService: "job-service",
  mediaService: "media-service",
  rabbitmq: "RabbitMQ",
};

const SideBar = ({ navItems, activePage, onNavigate, open, onClose, health }: SideBarProps) => (
  <>
    {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} aria-hidden />}
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-panel transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center border border-line-strong bg-panel-2 text-ink">
            <InfinityIcon className="size-5" strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">InfiniteFlow</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">frame interpolation</p>
          </div>
        </div>
        <button className="rounded-lg p-1.5 text-ink-dim hover:bg-panel-2 lg:hidden" onClick={onClose} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ page, label, icon: Icon, badge }) => {
          const active = page === activePage;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-l-2 border-flow bg-panel-2 text-ink" : "text-ink-dim hover:bg-panel-2 hover:text-ink",
              )}
            >
              <Icon className="size-4.5" />
              <span className="flex-1 text-left">{label}</span>
              {badge ? (
                <span className="rounded-full bg-flow px-2 py-0.5 text-xs font-semibold text-canvas">{badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-line bg-canvas/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">System</p>
        <ul className="space-y-1.5">
          {Object.entries(SERVICE_LABELS).map(([key, label]) => {
            const state = health?.[key];
            return (
              <li key={key} className="flex items-center justify-between text-xs">
                <span className="font-mono text-ink-dim">{label}</span>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    state === "UP" ? "bg-ok" : state === "DOWN" ? "bg-bad" : "bg-line-strong",
                  )}
                  title={state ?? "unknown"}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  </>
);

export default SideBar;
