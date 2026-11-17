import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/axios";
import Modal from "./Modal";

export type AuthMode = "login" | "register";

interface AuthModalProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onDone: (message: string) => void;
}

const field =
  "w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:border-ink-dim";

const AuthModal = ({ mode, onModeChange, onClose, onDone }: AuthModalProps) => {
  const { login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signUp = mode === "register";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const moved = signUp ? await register(email, password, name) : await login(email, password);
      onDone(
        moved > 0
          ? `${signUp ? "Account created" : "Logged in"}. ${moved} video${moved === 1 ? "" : "s"} from this browser moved to your history.`
          : signUp
            ? "Account created"
            : "Logged in",
      );
    } catch (err) {
      setError(errorMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={signUp ? "Create your account" : "Log in"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <p className="text-sm text-ink-dim">
          {signUp
            ? "Keep your video history on every device. The videos you already made in this browser come with you."
            : "Welcome back. Your video history will show up in the sidebar."}
        </p>

        {signUp && (
          <label className="block text-sm">
            <span className="mb-1.5 block text-ink-dim">Name (optional)</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1.5 block text-ink-dim">Email</span>
          <input
            className={field}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-ink-dim">Password</span>
          <input
            className={field}
            type="password"
            required
            minLength={signUp ? 8 : 1}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signUp ? "new-password" : "current-password"}
          />
          {signUp && <span className="mt-1 block text-xs text-ink-faint">At least 8 characters</span>}
        </label>

        {error && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-flow px-4 py-2.5 text-sm font-medium text-canvas hover:bg-flow-strong disabled:opacity-60"
        >
          {busy ? "Please wait…" : signUp ? "Sign up" : "Log in"}
        </button>

        <p className="text-center text-sm text-ink-dim">
          {signUp ? "Already have an account?" : "No account yet?"}{" "}
          <button
            type="button"
            className="text-ink underline underline-offset-2"
            onClick={() => {
              setError(null);
              onModeChange(signUp ? "login" : "register");
            }}
          >
            {signUp ? "Log in" : "Sign up"}
          </button>
        </p>
        <p className="text-center text-xs text-ink-faint">You can keep using InfiniteFlow without an account.</p>
      </form>
    </Modal>
  );
};

export default AuthModal;
