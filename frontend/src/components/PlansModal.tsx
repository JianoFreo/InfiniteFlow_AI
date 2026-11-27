import { Check } from "lucide-react";
import { useState } from "react";
import type { PlanLimits, PlanName } from "../interface/Usage";
import { formatSeconds, PLAN_LABEL } from "../interface/Usage";
import { errorMessage } from "../lib/axios";
import { useUsage } from "../lib/usage";
import { cn } from "../lib/utils";
import Modal from "./Modal";

interface PlansModalProps {
  /** Why it opened, e.g. the limit the person just hit. */
  reason?: string | null;
  onClose: () => void;
  onRegister: () => void;
}

const ORDER: PlanName[] = ["guest", "free", "pro"];

const features = (limits: PlanLimits) => [
  `${formatSeconds(limits.dailySeconds)} of video a day`,
  `Clips up to ${formatSeconds(limits.maxClipSeconds)}`,
  `Up to ${limits.maxFactor}x smoother`,
  limits.maxActive === 1 ? "1 video at a time" : `${limits.maxActive} videos at once`,
];

/** The three plans side by side, with the one next step that makes sense for the current plan. */
const PlansModal = ({ reason, onClose, onRegister }: PlansModalProps) => {
  const { usage, startCheckout, openPortal } = useUsage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (action: () => Promise<void>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await action(); // leaves the page on success
    } catch (err) {
      setError(errorMessage(err, "Could not reach the payment page"));
      setBusy(false);
    }
  };

  const current = usage?.plan ?? "guest";

  const action = (plan: PlanName) => {
    if (!usage || plan === "guest") return null;
    const button = "w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60";
    if (plan === "free" && current === "guest") {
      return (
        <button className={cn(button, "border border-line-strong hover:bg-panel-2")} onClick={onRegister}>
          Sign up free
        </button>
      );
    }
    if (plan !== "pro") return null;
    if (current === "pro") {
      return usage.billingEnabled ? (
        <button className={cn(button, "border border-line-strong hover:bg-panel-2")} disabled={busy} onClick={go(openPortal)}>
          Manage billing
        </button>
      ) : null;
    }
    if (!usage.billingEnabled) {
      return <p className="text-center text-xs text-ink-faint">Not available yet</p>;
    }
    return current === "guest" ? (
      <button className={cn(button, "bg-flow text-canvas hover:bg-flow-strong")} onClick={onRegister}>
        Sign up to upgrade
      </button>
    ) : (
      <button className={cn(button, "bg-flow text-canvas hover:bg-flow-strong")} disabled={busy} onClick={go(startCheckout)}>
        {busy ? "Opening checkout…" : "Upgrade to Pro"}
      </button>
    );
  };

  return (
    <Modal title="Plans" onClose={onClose} wide>
      <div className="space-y-4 p-5">
        <p className="text-sm text-ink-dim">
          {reason ?? "Every plan has a daily allowance of video. It frees up gradually over 24 hours."}
        </p>
        {!usage ? (
          <p className="text-sm text-ink-faint">Loading plans…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {ORDER.map((plan) => (
              <div
                key={plan}
                className={cn(
                  "flex flex-col gap-4 rounded-lg border p-4",
                  plan === "pro" ? "border-flow" : "border-line",
                  plan === current && "bg-panel-2",
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold">{PLAN_LABEL[plan]}</p>
                    {plan === current && <span className="text-[11px] text-ink-faint">Current plan</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-dim">
                    {plan === "pro" ? usage.proPriceLabel : plan === "free" ? "Free with an account" : "No account"}
                  </p>
                </div>
                <ul className="flex-1 space-y-2 text-sm">
                  {features(usage.plans[plan]).map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-ink-faint" strokeWidth={2} aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {action(plan)}
              </div>
            ))}
          </div>
        )}
        {error && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
        {usage?.plan === "pro" && usage.renewsAt && (
          <p className="text-xs text-ink-faint">
            {usage.subscriptionStatus === "active" || usage.subscriptionStatus === "trialing" ? "Renews" : "Ends"} on{" "}
            {new Date(usage.renewsAt).toLocaleDateString()}.
          </p>
        )}
        <p className="text-xs text-ink-faint">Payments are handled by Stripe. You can cancel at any time.</p>
      </div>
    </Modal>
  );
};

export default PlansModal;
