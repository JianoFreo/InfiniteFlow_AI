import { createHmac } from "node:crypto";
import { isIPv6 } from "node:net";
import type { Request } from "express";
import { ENV } from "../config/env.js";

/**
 * IPv4 as is. IPv6 by its /64 network: one home or phone usually gets a whole /64, so counting single
 * IPv6 addresses would let a guest pick a new one per upload.
 */
export const networkOf = (ip: string) => {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1]!;
  if (!isIPv6(ip)) return ip;
  const [head = "", tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
};

/**
 * A stable, private stand-in for the caller's network address. Guests are limited per address as well as
 * per browser id, so clearing site data does not reset the daily allowance. Only this hash is sent on.
 */
export const clientKey = (req: Pick<Request, "ip" | "socket">) =>
  createHmac("sha256", ENV.AUTH_SECRET)
    .update(`ip:${networkOf(req.ip ?? req.socket.remoteAddress ?? "unknown")}`)
    .digest("hex")
    .slice(0, 32);
