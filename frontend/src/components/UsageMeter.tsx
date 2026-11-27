import { formatSeconds, formatUntil, PLAN_LABEL } from "../interface/Usage";
import { useUsage } from "../lib/usage";
import { cn } from "../lib/utils";

/** Sidebar footer: plan, how much video is left today, and the way to more. */
const UsageMeter = ({ onPlans }: { onPlans: () => void }) => {
  const { usage } = useUsage();
  if (!usage) return null;

  const { plan, limits, usedSeconds, remainingSeconds } = usage;
  const share = limits.dailySeconds > 0 ? Math.min(1, usedSeconds / limits.dailySeconds) : 1;
  const out = remainingSeconds <= 0;
  const low = !out && share >= 0.8;
  const resets = formatUntil(usage.resetsAt);
  const cta = plan === "guest" ? "Get more" : plan === "free" && usage.billingEnabled ? "Upgrade" : "Plans";

  return (
    <div className="border-t border-line px-5 py-3">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-ink">{PLAN_LABEL[plan]} plan</span>
        <span className={cn(out ? "text-bad" : low ? "text-warn" : "text-ink-dim")}>
          {out ? "None left today" : `${formatSeconds(remainingSeconds)} left today`}
        </span>
      </div>
      <div
        className="mt-2 h-1 bg-line"
        role="progressbar"
        aria-label="Video used today"
        aria-valuemin={0}
        aria-valuemax={limits.dailySeconds}
        aria-valuenow={Math.min(usedSeconds, limits.dailySeconds)}
        aria-valuetext={`${formatSeconds(usedSeconds)} of ${formatSeconds(limits.dailySeconds)} used`}
      >
        <div className={cn("h-full transition-[width]", out ? "bg-bad" : low ? "bg-warn" : "bg-flow")} style={{ width: `${share * 100}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-ink-faint">
        <span className="truncate">
          {formatSeconds(usedSeconds)} of {formatSeconds(limits.dailySeconds)}
          {resets && usedSeconds > 0 ? ` · frees up ${resets}` : ""}
        </span>
        <button onClick={onPlans} className="shrink-0 text-ink-dim underline underline-offset-2 hover:text-ink">
          {cta}
        </button>
      </div>
    </div>
  );
};

export default UsageMeter;
