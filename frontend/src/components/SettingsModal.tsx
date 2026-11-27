import { useState } from "react";
import type { ReactNode } from "react";
import type { JobMode, PreprocessStep } from "../interface/Job";
import { formatSeconds, PLAN_LABEL } from "../interface/Usage";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/axios";
import { useUsage } from "../lib/usage";
import { useSettings } from "../lib/settings";
import type { ThemeChoice } from "../lib/settings";
import { cn } from "../lib/utils";
import Modal from "./Modal";

export type SettingsTab = "general" | "account" | "about";

interface SettingsModalProps {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onPlans: () => void;
}

const TABS: Array<{ key: SettingsTab; label: string }> = [
  { key: "general", label: "General" },
  { key: "account", label: "Account" },
  { key: "about", label: "About" },
];

const THEMES: Array<{ key: ThemeChoice; label: string }> = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

const MODES: Array<{ key: JobMode; label: string }> = [
  { key: "flow", label: "Optical flow" },
  { key: "blend", label: "Blend" },
];

const STEPS: Array<{ key: PreprocessStep; label: string }> = [
  { key: "denoise", label: "Denoise" },
  { key: "deband", label: "Deband" },
  { key: "sharpen", label: "Sharpen" },
];

const Row = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
    <div className="min-w-0">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
    {children}
  </div>
);

const Segmented = <T extends string>({ value, options, onChange }: { value: T; options: Array<{ key: T; label: string }>; onChange: (value: T) => void }) => (
  <div className="flex rounded-lg border border-line-strong p-0.5">
    {options.map(({ key, label }) => (
      <button
        key={key}
        onClick={() => onChange(key)}
        aria-pressed={value === key}
        className={cn(
          "rounded-md px-3 py-1 text-sm transition-colors",
          value === key ? "bg-panel-2 text-ink" : "text-ink-dim hover:text-ink",
        )}
      >
        {label}
      </button>
    ))}
  </div>
);

const Switch = ({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-flow" : "bg-line-strong")}
  >
    <span
      className={cn("absolute top-0.5 size-5 rounded-full bg-canvas transition-[left]", on ? "left-[18px]" : "left-0.5")}
    />
  </button>
);

const General = () => {
  const { settings, update, reset, resolvedTheme } = useSettings();
  const toggleStep = (step: PreprocessStep) =>
    update({
      defaultPreprocess: settings.defaultPreprocess.includes(step)
        ? settings.defaultPreprocess.filter((s) => s !== step)
        : [...settings.defaultPreprocess, step],
    });

  return (
    <div className="divide-y divide-line px-5">
      <Row title="Theme" hint="System follows your device setting.">
        <Segmented value={settings.theme} options={THEMES} onChange={(theme) => update({ theme })} />
      </Row>
      <Row title="Star background" hint={resolvedTheme === "light" ? "Only shown in the dark theme." : "The animated night sky behind the app."}>
        <Switch on={settings.starfield} onChange={(starfield) => update({ starfield })} label="Star background" />
      </Row>
      <Row title="Default factor" hint="Used when you start a new video.">
        <select
          value={settings.defaultFactor}
          onChange={(event) => update({ defaultFactor: Number(event.target.value) })}
          className="rounded-lg border border-line-strong bg-canvas px-3 py-1.5 text-sm outline-none"
        >
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
      </Row>
      <Row title="Default method">
        <Segmented value={settings.defaultMode} options={MODES} onChange={(defaultMode) => update({ defaultMode })} />
      </Row>
      <Row title="Default pre-processing" hint="Clean-up applied to every frame before interpolation.">
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleStep(key)}
              aria-pressed={settings.defaultPreprocess.includes(key)}
              className={cn(
                "rounded-lg border px-3 py-1 text-sm transition-colors",
                settings.defaultPreprocess.includes(key)
                  ? "border-ink-dim bg-panel-2 text-ink"
                  : "border-line-strong text-ink-dim hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Row>
      <div className="flex items-center justify-between py-3.5">
        <p className="text-xs text-ink-faint">Settings are saved in this browser.</p>
        <button onClick={reset} className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink-dim hover:text-ink">
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

const PlanRow = ({ onPlans }: { onPlans: () => void }) => {
  const { usage, openPortal } = useUsage();
  const [error, setError] = useState<string | null>(null);
  if (!usage) return null;
  const hint = `${formatSeconds(usage.limits.dailySeconds)} of video a day, clips up to ${formatSeconds(usage.limits.maxClipSeconds)}, up to ${usage.limits.maxFactor}×.`;
  return (
    <Row title={`${PLAN_LABEL[usage.plan]} plan`} hint={error ?? hint}>
      {usage.plan === "pro" && usage.billingEnabled ? (
        <button
          onClick={() => openPortal().catch((err) => setError(errorMessage(err, "Could not open billing")))}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-sm hover:bg-panel-2"
        >
          Manage billing
        </button>
      ) : (
        <button onClick={onPlans} className="rounded-lg border border-line-strong px-3 py-1.5 text-sm hover:bg-panel-2">
          {usage.plan === "free" && usage.billingEnabled ? "Upgrade" : "See plans"}
        </button>
      )}
    </Row>
  );
};

const Account = ({ onLogin, onRegister, onPlans }: Pick<SettingsModalProps, "onLogin" | "onRegister" | "onPlans">) => {
  const { user, logout } = useAuth();

  if (user) {
    return (
      <div className="divide-y divide-line px-5">
        <Row title="Signed in as" hint={user.name || undefined}>
          <span className="text-sm text-ink-dim">{user.email}</span>
        </Row>
        <PlanRow onPlans={onPlans} />
        <Row title="History" hint="Your videos are saved to your account and follow you to any device.">
          <span className="text-sm text-ink-dim">Account</span>
        </Row>
        <div className="py-3.5">
          <button onClick={logout} className="rounded-lg border border-line-strong px-3 py-1.5 text-sm hover:bg-panel-2">
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">
      <div>
        <p className="text-sm font-medium">You are using InfiniteFlow as a guest</p>
        <p className="mt-1 text-sm text-ink-dim">
          Everything works without an account. Your history is kept in this browser only, so clearing site data or
          switching devices loses it. Sign up to keep it safe and see it anywhere.
        </p>
      </div>
      <div className="border-y border-line">
        <PlanRow onPlans={onPlans} />
      </div>
      <div className="flex gap-2">
        <button onClick={onRegister} className="rounded-lg bg-flow px-4 py-2 text-sm font-medium text-canvas hover:bg-flow-strong">
          Sign up
        </button>
        <button onClick={onLogin} className="rounded-lg border border-line-strong px-4 py-2 text-sm hover:bg-panel-2">
          Log in
        </button>
      </div>
    </div>
  );
};

const STACK: Array<[string, string]> = [
  ["Interface", "React, TypeScript, Vite, Tailwind"],
  ["API gateway", "Express (TypeScript)"],
  ["Services", "Spring Boot: jobs, accounts, media"],
  ["Engine", "Python and NumPy optical flow, no pretrained models"],
  ["Plumbing", "PostgreSQL, FFmpeg, server-sent events"],
];

const About = () => (
  <div className="space-y-6 p-5">
    <div>
      <p className="text-lg font-semibold">InfiniteFlow</p>
      <p className="mt-1 text-sm text-ink-dim">
        Turns any video into smooth, high-frame-rate motion. It creates the in-between frames with a hand-written
        optical-flow engine, so nothing is a black box.
      </p>
      <p className="mt-2 text-xs text-ink-faint">Version 1.0.0</p>
    </div>

    <div className="rounded-lg border border-line p-4">
      <p className="text-xs text-ink-faint">Created by</p>
      <p className="mt-1 text-base font-medium">Jiano Freo</p>
      <p className="mt-1 text-sm text-ink-dim">Designed and built InfiniteFlow, from the interface to the interpolation engine.</p>
    </div>

    <div>
      <p className="mb-2 text-sm font-medium">Built with</p>
      <dl className="divide-y divide-line rounded-lg border border-line">
        {STACK.map(([name, value]) => (
          <div key={name} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
            <dt className="text-ink-faint">{name}</dt>
            <dd className="text-right text-ink-dim">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  </div>
);

const SettingsModal = ({ tab, onTabChange, onClose, onLogin, onRegister, onPlans }: SettingsModalProps) => (
  <Modal title="Settings" onClose={onClose} wide>
    <div className="flex gap-1 border-b border-line px-4 pt-2">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          aria-current={tab === key}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            tab === key ? "border-ink text-ink" : "border-transparent text-ink-dim hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
    {tab === "general" && <General />}
    {tab === "account" && <Account onLogin={onLogin} onRegister={onRegister} onPlans={onPlans} />}
    {tab === "about" && <About />}
  </Modal>
);

export default SettingsModal;
