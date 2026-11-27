import type { CSSProperties } from "react";
import { cn } from "../../../lib/utils";

interface FactorSliderProps {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  /** Highest factor the current plan allows. Higher steps are shown but can't be picked. */
  allowedMax?: number;
  onPlans?: () => void;
}

const MIN = 2;
const MAX = 8;

const FactorSlider = ({ value, disabled, onChange, allowedMax = MAX, onPlans }: FactorSliderProps) => {
  const fill = ((value - MIN) / (MAX - MIN)) * 100;
  const locked = allowedMax < MAX;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor="factor" className="text-sm font-medium">
          Interpolation factor
        </label>
        <span className="text-lg font-semibold">{value}×</span>
      </div>
      <input
        id="factor"
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Math.min(allowedMax, Number(event.target.value)))}
        aria-valuetext={locked ? `${value}×, your plan allows up to ${allowedMax}×` : `${value}×`}
        className="factor-slider mt-3 w-full disabled:opacity-50"
        style={{ "--fill": `${fill}%` } as CSSProperties}
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
        {Array.from({ length: MAX - MIN + 1 }, (_, i) => (
          <span key={i} className={cn(i + MIN > allowedMax && "opacity-40")}>
            {i + MIN}×
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-dim">
        e.g. 30 → {30 * value} fps
        {locked && (
          <>
            {" · "}Your plan goes up to {allowedMax}×.{" "}
            {onPlans && (
              <button type="button" onClick={onPlans} className="text-ink underline underline-offset-2">
                Unlock {MAX}×
              </button>
            )}
          </>
        )}
      </p>
    </div>
  );
};

export default FactorSlider;
