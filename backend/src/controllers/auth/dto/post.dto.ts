/** A logged-in session: the token to send back as "Authorization: Bearer ...", and who it belongs to. */
interface session {
  token: string;
  user: { id: number; email: string; name: string | null };
  /** How many videos from this browser (as a guest) were moved into the account. */
  moved: number;
}

/** POST /api/auth/register */
export namespace register {
  export interface body {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  }
  export interface response extends session {
    message: string;
  }
  export interface error {
    message: string;
  }
}

/** POST /api/auth/login */
export namespace login {
  export interface body {
    email?: unknown;
    password?: unknown;
  }
  export interface response extends session {
    message: string;
  }
  export interface error {
    message: string;
  }
}
