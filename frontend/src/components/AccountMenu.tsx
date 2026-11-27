import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "../lib/identity";
import { cn } from "../lib/utils";
import type { SettingsTab } from "./SettingsModal";

interface AccountMenuProps {
  user: AuthUser | null;
  onSettings: (tab: SettingsTab) => void;
  onPlans: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => void;
}

const item = "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2";

/** Bottom-left account row, like ChatGPT: click it for Settings, Plans, About and log in / out. */
const AccountMenu = ({ user, onSettings, onPlans, onLogin, onRegister, onLogout }: AccountMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = user ? user.name || user.email : "Guest";
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative border-t border-line p-3">
      {open && (
        <div className="absolute inset-x-3 bottom-[calc(100%-0.25rem)] z-10 rounded-xl border border-line bg-canvas p-1.5 shadow-xl">
          {user && <p className="truncate px-3 py-2 text-xs text-ink-faint">{user.email}</p>}
          <button className={item} onClick={choose(() => onSettings("general"))}>
            Settings
          </button>
          <button className={item} onClick={choose(onPlans)}>
            Plans
          </button>
          <button className={item} onClick={choose(() => onSettings("about"))}>
            About
          </button>
          <div className="my-1 border-t border-line" />
          {user ? (
            <button className={item} onClick={choose(onLogout)}>
              Log out
            </button>
          ) : (
            <>
              <button className={item} onClick={choose(onRegister)}>
                Sign up
              </button>
              <button className={item} onClick={choose(onLogin)}>
                Log in
              </button>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panel-2", open && "bg-panel-2")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-strong text-sm font-medium">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{label}</span>
          {!user && <span className="block truncate text-xs text-ink-faint">History saved in this browser</span>}
        </span>
      </button>
    </div>
  );
};

export default AccountMenu;
