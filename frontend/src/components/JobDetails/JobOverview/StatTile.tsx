import type { LucideIcon } from "lucide-react";

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}

const StatTile = ({ icon: Icon, label, value, detail }: StatTileProps) => (
  <div className="rounded-xl border border-line bg-canvas/60 p-3.5">
    <p className="flex items-center gap-1.5 text-xs text-ink-faint">
      <Icon className="size-3.5" />
      {label}
    </p>
    <p className="mt-1.5 font-mono text-lg font-semibold">{value}</p>
    {detail && <p className="mt-0.5 truncate text-xs text-ink-dim">{detail}</p>}
  </div>
);

export default StatTile;
