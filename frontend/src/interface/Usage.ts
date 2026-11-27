export type PlanName = "guest" | "free" | "pro";

export interface PlanLimits {
  /** Source-video seconds per rolling 24 hours. */
  dailySeconds: number;
  maxClipSeconds: number;
  maxFactor: number;
  maxActive: number;
}

/** GET /api/usage */
export interface Usage {
  plan: PlanName;
  limits: PlanLimits;
  usedSeconds: number;
  remainingSeconds: number;
  /** When the oldest counted video leaves the 24-hour window. */
  resetsAt: string | null;
  activeJobs: number;
  subscriptionStatus: string | null;
  renewsAt: string | null;
  plans: Record<PlanName, PlanLimits>;
  billingEnabled: boolean;
  proPriceLabel: string;
}

export const PLAN_LABEL: Record<PlanName, string> = { guest: "Guest", free: "Free", pro: "Pro" };

/** Error codes the BFF uses for plan limits. */
export const LIMIT_CODES = ["too_many_running", "plan_limit", "quota_exceeded"];

/** 45 -> "45 s", 180 -> "3 min", 90 -> "1 min 30 s" (same wording as the server). */
export const formatSeconds = (seconds: number) => {
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${min} min` : `${min} min ${s} s`;
};

/** "in 2 h 10 min" until the given time, or null when it has passed. */
export const formatUntil = (iso: string | null, now = Date.now()) => {
  if (!iso) return null;
  const minutes = Math.floor((Date.parse(iso) - now) / 60_000);
  if (minutes < 0) return null;
  if (minutes < 1) return "in under a minute";
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
};
