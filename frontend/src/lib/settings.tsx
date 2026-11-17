import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { JobMode, PreprocessStep } from "../interface/Job";

export type ThemeChoice = "system" | "light" | "dark";

export interface Settings {
  theme: ThemeChoice;
  /** Animated star background (dark theme only). */
  starfield: boolean;
  defaultFactor: number;
  defaultMode: JobMode;
  defaultPreprocess: PreprocessStep[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  starfield: true,
  defaultFactor: 4,
  defaultMode: "flow",
  defaultPreprocess: [],
};

const KEY = "if-settings";

const load = (): Settings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // unreadable or blocked storage: fall back to defaults
  }
  return DEFAULT_SETTINGS;
};

const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

interface SettingsContextValue {
  settings: Settings;
  /** The theme actually shown, after resolving "system". */
  resolvedTheme: "light" | "dark";
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(load);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const persist = (next: Settings) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage blocked: the choice applies until the tab closes
    }
  };

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    persist(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, resolvedTheme, update, reset }), [settings, resolvedTheme, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside <SettingsProvider>");
  return value;
};
