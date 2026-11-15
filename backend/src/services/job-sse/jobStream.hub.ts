import type { Response } from "express";

/**
 * Same shape as TechCare's queue monitor hub:
 *  - screens are kept in an in-memory Set (single BFF instance)
 *  - max 50 screens, 503 beyond
 *  - retry: 3000 tells the browser how fast to reconnect
 *  - ping every 25 s so proxies don't close idle connections
 *  - bursts are coalesced: progress for a job can arrive several times a second from several engines,
 *    so events are collected per job and flushed every 200 ms as one message.
 *
 * Difference from TechCare: events carry a tiny payload {id,status,progress,...}, because a progress bar
 * moving 2x per second shouldn't make every browser refetch the whole job list. The client still
 * refetches from REST when a job changes status, so REST stays the source of truth.
 */
export const MAX_SCREENS = 50;
const PING_MS = 25_000;
const FLUSH_MS = 200;

export interface JobChangeEvent {
  id: number;
  status: string;
  progress: number;
  completedChunks: number;
  totalChunks: number;
}

const screens = new Set<Response>();
const pending = new Map<number, JobChangeEvent>();
let flushTimer: NodeJS.Timeout | null = null;
let pingTimer: NodeJS.Timeout | null = null;

const write = (res: Response, event: string, data: unknown) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

const broadcast = (event: string, data: unknown) => {
  for (const res of screens) write(res, event, data);
};

export const hasCapacity = () => screens.size < MAX_SCREENS;

export const addScreen = (res: Response) => {
  screens.add(res);
  if (!pingTimer) {
    pingTimer = setInterval(() => broadcast("ping", { at: Date.now() }), PING_MS);
  }
};

export const removeScreen = (res: Response) => {
  screens.delete(res);
  if (screens.size === 0 && pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
};

export const publishJobChange = (event: JobChangeEvent) => {
  pending.set(event.id, event); // newer event for the same job replaces the older one
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = [...pending.values()];
    pending.clear();
    if (batch.length > 0) broadcast("job-changed", batch);
  }, FLUSH_MS);
};

export const getJobStreamStats = () => ({ connectedScreens: screens.size, maxScreens: MAX_SCREENS });

/** Called on SIGTERM so server.close() doesn't hang waiting for open streams. */
export const closeAllJobStreams = () => {
  for (const res of screens) res.end();
  screens.clear();
  if (pingTimer) clearInterval(pingTimer);
  if (flushTimer) clearTimeout(flushTimer);
  pingTimer = null;
  flushTimer = null;
};
