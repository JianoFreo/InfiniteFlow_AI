import { Check } from "lucide-react";
import type { PreprocessStep } from "../../../interface/Job";
import { cn } from "../../../lib/utils";

interface PreprocessOptionsProps {
  value: PreprocessStep[];
  disabled: boolean;
  onChange: (steps: PreprocessStep[]) => void;
}

const STEPS: Array<{ step: PreprocessStep; title: string; description: string }> = [
  { step: "denoise", title: "Denoise", description: "Removes grain so motion tracking isn't confused by noise." },
  { step: "deband", title: "Deband", description: "Smooths stripes in skies and gradients." },
  { step: "sharpen", title: "Sharpen", description: "Restores crispness on soft footage." },
];

const PreprocessOptions = ({ value, disabled, onChange }: PreprocessOptionsProps) => {
  const toggle = (step: PreprocessStep) =>
    onChange(value.includes(step) ? value.filter((s) => s !== step) : [...value, step]);

  return (
    <fieldset>
      <legend className="text-sm font-medium">
        Pre-processing <span className="font-normal text-ink-faint">· optional, applied before interpolation</span>
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {STEPS.map(({ step, title, description }) => {
          const on = value.includes(step);
          return (
            <button
              key={step}
              type="button"
              disabled={disabled}
              onClick={() => toggle(step)}
              aria-pressed={on}
              title={description}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-50",
                on ? "border-ink-dim bg-panel-2 text-ink" : "border-line-strong text-ink-dim hover:bg-panel-2 hover:text-ink",
              )}
            >
              {on && <Check className="size-3.5" />}
              {title}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {value.length === 0
          ? "Off: frames go to the interpolator untouched."
          : STEPS.filter((s) => value.includes(s.step)).map((s) => s.description).join(" ")}
      </p>
    </fieldset>
  );
};

export default PreprocessOptions;
