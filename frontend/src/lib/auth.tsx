import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./axios";
import { clearSession, currentOwner, getStoredUser, saveSession } from "./identity";
import type { AuthUser } from "./identity";

interface AuthContextValue {
  user: AuthUser | null;
  /** Changes whenever the history switches between guest and account. Reload data when it does. */
  owner: string;
  login: (email: string, password: string) => Promise<number>;
  register: (email: string, password: string, name: string) => Promise<number>;
  logout: () => void;
}

interface SessionResponse {
  token: string;
  user: AuthUser;
  moved: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);
  const [owner, setOwner] = useState(currentOwner);

  const refresh = useCallback(() => {
    setUser(getStoredUser());
    setOwner(currentOwner());
  }, []);

  useEffect(() => {
    window.addEventListener("auth-expired", refresh);
    return () => window.removeEventListener("auth-expired", refresh);
  }, [refresh]);

  const start = useCallback(
    (data: SessionResponse) => {
      saveSession(data.token, data.user);
      refresh();
      return data.moved;
    },
    [refresh],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      owner,
      login: async (email, password) => start((await api.post<SessionResponse>("/api/auth/login", { email, password })).data),
      register: async (email, password, name) =>
        start((await api.post<SessionResponse>("/api/auth/register", { email, password, name })).data),
      logout: () => {
        clearSession();
        refresh();
      },
    }),
    [user, owner, start, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
};
