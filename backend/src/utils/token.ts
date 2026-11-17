import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "../config/env.js";

/** A tiny HS256 JWT (header.payload.signature), so the BFF stays stateless and needs no extra dependency. */
export interface TokenPayload {
  sub: number; // user id
  email: string;
  name: string | null;
  exp: number; // seconds since epoch
}

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

const sign = (data: string) => createHmac("sha256", ENV.AUTH_SECRET).update(data).digest("base64url");

export const signToken = (user: { id: number; email: string; name: string | null }) => {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${HEADER}.${body}.${sign(`${HEADER}.${body}`)}`;
};

/** Returns the payload, or null when the token is malformed, tampered with or expired. */
export const verifyToken = (token: string): TokenPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];

  const expected = Buffer.from(sign(`${header}.${body}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (typeof payload.sub !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
};
