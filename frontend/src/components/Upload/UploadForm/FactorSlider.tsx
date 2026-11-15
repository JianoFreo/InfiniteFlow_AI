import type { CSSProperties } from "react";

interface FactorSliderProps {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

const MIN = 2;
const MAX = 8;
const EXAMPLES = [24, 30, 60];

const FactorSlider = ({ value, disabled, onChange }: FactorSliderProps) => {
  const fill = ((value - MIN) / (MAX - MIN)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor="factor" className="text-sm font-medium">
          Interpolation factor
        </label>
        <span className="font-mono text-2xl font-semibold text-flow">{value}×</span>
      </div>
      <input
        id="factor"
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="factor-slider mt-3 w-full disabled:opacity-50"
        style={{ "--fill": `${fill}%` } as CSSProperties}
      />
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-ink-faint">
        {Array.from({ length: MAX - MIN + 1 }, (_, i) => (
          <span key={i}>{i + MIN}×</span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-dim">
        {value - 1} new frame{value > 2 ? "s" : ""} between every pair:{" "}
        {EXAMPLES.map((fps) => `${fps} → ${fps * value} fps`).join(" · ")}
      </p>
    </div>
  );
};

export default FactorSlider;
