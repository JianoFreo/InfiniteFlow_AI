interface StatTileProps {
  label: string;
  value: string;
  detail?: string;
}

const StatTile = ({ label, value, detail }: StatTileProps) => (
  <div className="rounded-lg border border-line p-3.5">
    <p className="text-xs text-ink-faint">{label}</p>
    <p className="mt-1 text-lg font-semibold">{value}</p>
    {detail && <p className="mt-0.5 truncate text-xs text-ink-dim">{detail}</p>}
  </div>
);

export default StatTile;
