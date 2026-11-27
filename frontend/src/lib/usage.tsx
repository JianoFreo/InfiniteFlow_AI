import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Usage } from "../interface/Usage";
import { useAuth } from "./auth";
import { api } from "./axios";

interface UsageContextValue {
  /** Null until the first load (or when the server can't be reached). */
  usage: Usage | null;
  refresh: () => Promise<Usage | null>;
  /** Sends the browser to Stripe Checkout for Pro. */
  startCheckout: () => Promise<void>;
  /** Sends the browser to Stripe's billing portal (change card, cancel). */
  openPortal: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue | null>(null);
const REFRESH_MS = 120_000; // the allowance frees up over time, so keep the meter roughly current

/** The caller's plan and how much of today's allowance is left. Reloads when the person logs in or out. */
export const UsageProvider = ({ children }: { children: ReactNode }) => {
  const { owner } = useAuth();
  const [usage, setUsage] = useState<Usage | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<Usage>("/api/usage");
      setUsage(data);
      return data;
    } catch {
      return null; // the meter just stays as it was
    }
  }, []);

  useEffect(() => {
    setUsage(null);
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [owner, refresh]);

  const value = useMemo<UsageContextValue>(
    () => ({
      usage,
      refresh,
      startCheckout: async () => {
        const { data } = await api.post<{ url: string }>("/api/billing/checkout");
        window.location.assign(data.url);
      },
      openPortal: async () => {
        const { data } = await api.post<{ url: string }>("/api/billing/portal");
        window.location.assign(data.url);
      },
    }),
    [usage, refresh],
  );

  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
};

export const useUsage = () => {
  const value = useContext(UsageContext);
  if (!value) throw new Error("useUsage must be used inside <UsageProvider>");
  return value;
};
