import type { JobMode } from "../../../interface/Job";
import { cn } from "../../../lib/utils";

interface ModeToggleProps {
  value: JobMode;
  disabled: boolean;
  onChange: (mode: JobMode) => void;
}

const MODES: Array<{ mode: JobMode; title: string; description: string; }> = [
  {
    mode: "flow",
    title: "Optical flow",
    description: "Tracks motion and moves pixels to their in-between position. Smooth, no ghosting.",
  },
  {
    mode: "blend",
    title: "Blend",
    description: "Cross-fades neighbouring frames. Fastest, but moving objects leave a ghost.",
  },
];

const ModeToggle = ({ value, disabled, onChange }: ModeToggleProps) => (
  <fieldset>
    <legend className="text-sm font-medium">Method</legend>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {MODES.map(({ mode, title, description }) => {
        const selected = value === mode;
        return (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mode)}
            aria-pressed={selected}
            className={cn(
              "rounded-lg border p-3.5 text-left transition-colors disabled:opacity-50",
              selected ? "border-ink-dim bg-panel-2" : "border-line hover:border-line-strong",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {title}
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-ink-dim">{description}</span>
          </button>
        );
      })}
    </div>
  </fieldset>
);

export default ModeToggle;
