import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source";
import { apiUrl } from "../../lib/axios";
import { authHeaders } from "../../lib/identity";
import type { JobChangeEvent } from "../../interface/Job";

/**
 * SSE client, same shape as TechCare's connectQueueStream:
 *  - fetch-event-source instead of EventSource, so an Authorization header can be added once auth exists
 *  - backoff 2 s, 4 s, 8 s, then 15 s max
 *  - 65 s without any message (the BFF pings every 25 s) forces a reconnect
 *  - onLive fires on every (re)connect, and the caller reloads from REST then: REST stays the source of truth
 */
export type StreamState = "connecting" | "live" | "offline";

interface Handlers {
  onLive: () => void;
  onJobsChanged: (events: JobChangeEvent[]) => void;
  onStateChange: (state: StreamState) => void;
}

const BACKOFF_MS = [2_000, 4_000, 8_000, 15_000];
const SILENCE_MS = 65_000;

class RetriableError extends Error {}

export const connectJobStream = ({ onLive, onJobsChanged, onStateChange }: Handlers) => {
  let attempt = 0;
  let stopped = false;
  let controller = new AbortController();
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const resetSilenceTimer = () => {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      // Connection looks open but nothing arrives: drop it and start over.
      controller.abort();
      if (!stopped) start();
    }, SILENCE_MS);
  };

  const start = () => {
    controller = new AbortController();
    onStateChange("connecting");

    void fetchEventSource(apiUrl("/api/jobs/stream"), {
      signal: controller.signal,
      headers: authHeaders(),
      openWhenHidden: true,
      async onopen(response) {
        if (response.ok && response.headers.get("content-type")?.startsWith(EventStreamContentType)) {
          attempt = 0;
          resetSilenceTimer();
          onStateChange("live");
          onLive();
          return;
        }
        throw new RetriableError(`stream refused (${response.status})`);
      },
      onmessage(message) {
        resetSilenceTimer();
        if (message.event === "job-changed") {
          try {
            onJobsChanged(JSON.parse(message.data) as JobChangeEvent[]);
          } catch {
            /* ignore malformed batch */
          }
        }
      },
      onclose() {
        throw new RetriableError("stream closed by server");
      },
      onerror() {
        if (stopped) throw new Error("stopped"); // a thrown error ends fetchEventSource for good
        onStateChange("offline");
        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        attempt += 1;
        return delay; // returning a number = retry after that many ms
      },
    }).catch(() => undefined);
  };

  start();

  return () => {
    stopped = true;
    clearTimeout(silenceTimer);
    controller.abort();
  };
};
