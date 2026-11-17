/**
 * Who is using the app. Nobody has to sign up: every browser gets a random guest id, and that id is what its
 * history is filed under. Signing up or logging in swaps it for an account token (the BFF moves the guest's
 * videos into the account at that moment).
 */
const GUEST_KEY = "if-guest-id";
const TOKEN_KEY = "if-token";
const USER_KEY = "if-user";

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage blocked: the session just won't survive a reload
  }
};

let memoryGuestId: string | null = null;

export const getGuestId = (): string => {
  const saved = read(GUEST_KEY);
  if (saved) return saved;
  memoryGuestId ??= crypto.randomUUID();
  write(GUEST_KEY, memoryGuestId);
  return memoryGuestId;
};

export const getToken = () => read(TOKEN_KEY);

export const getStoredUser = (): AuthUser | null => {
  const raw = read(USER_KEY);
  if (!raw || !getToken()) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const saveSession = (token: string, user: AuthUser) => {
  write(TOKEN_KEY, token);
  write(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  write(TOKEN_KEY, null);
  write(USER_KEY, null);
};

/** Headers for fetch/axios calls. */
export const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return { "X-Guest-Id": getGuestId(), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

/** For <video src> and <a href>, which cannot send headers. */
export const withAuthQuery = (url: string) => {
  const token = getToken();
  const param = token ? `token=${encodeURIComponent(token)}` : `guest=${encodeURIComponent(getGuestId())}`;
  return `${url}${url.includes("?") ? "&" : "?"}${param}`;
};

/** What the history is filed under right now (changes on login and logout). */
export const currentOwner = () => {
  const user = getStoredUser();
  return user ? `u:${user.id}` : `g:${getGuestId()}`;
};
