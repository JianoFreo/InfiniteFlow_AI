import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/token.js";

export interface Identity {
  /** "u:<userId>" for an account, "g:<guestId>" for a guest browser. This is what jobs are filed under. */
  owner: string;
  user: { id: number; email: string; name: string | null } | null;
  guestId: string | null;
}

const GUEST_ID = /^[A-Za-z0-9-]{16,64}$/;

const first = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/**
 * Works out who is calling, for every request that touches jobs:
 *  - a valid login token (Authorization: Bearer ..., or ?token=... for <video> and <a> tags that cannot send headers)
 *  - otherwise the random guest id the browser made for itself (X-Guest-Id, or ?guest=...)
 * Nobody needs an account to use the product; the account only decides where the history is kept.
 */
export const identify = (req: Request, res: Response, next: NextFunction) => {
  const header = first(req.headers.authorization)?.replace(/^Bearer\s+/i, "");
  const token = header ?? first(req.query.token);
  const guest = first(req.headers["x-guest-id"]) ?? first(req.query.guest);
  const guestId = guest && GUEST_ID.test(guest) ? guest : null;

  if (token) {
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ message: "Your session expired. Please log in again." });
    const identity: Identity = {
      owner: `u:${payload.sub}`,
      user: { id: payload.sub, email: payload.email, name: payload.name },
      guestId,
    };
    res.locals.identity = identity;
    return next();
  }

  if (!guestId) return res.status(401).json({ message: "Missing identity" });
  res.locals.identity = { owner: `g:${guestId}`, user: null, guestId } satisfies Identity;
  next();
};
