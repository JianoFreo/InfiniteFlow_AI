import amqp from "amqplib";
import { ENV } from "../../config/env.js";
import { publishJobChange } from "./jobStream.hub.js";

/**
 * Bridge RabbitMQ → SSE. job-service broadcasts every job change on the `job.events` fanout exchange;
 * the BFF binds its own temporary queue to it and forwards each event to the browsers.
 * Same idea as TechCare's publishQueueChange(), except the change comes from another service, not the same process.
 */
const EXCHANGE = "job.events";
const RECONNECT_MS = 3_000;

let connected = false;
let stopped = false;
let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;

interface ServiceJobEvent {
  jobId: number;
  status: string;
  progress: number;
  completedChunks: number;
  totalChunks: number;
}

export const isRabbitConnected = () => connected;

export const startJobEventListener = async (): Promise<void> => {
  stopped = false;
  try {
    connection = await amqp.connect(ENV.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, "fanout", { durable: true });
    // Server-named, exclusive queue: deleted automatically when the BFF disconnects.
    const { queue } = await channel.assertQueue("", { exclusive: true, autoDelete: true });
    await channel.bindQueue(queue, EXCHANGE, "");

    await channel.consume(
      queue,
      (msg) => {
        if (!msg) return;
        try {
          const event = JSON.parse(msg.content.toString()) as ServiceJobEvent;
          publishJobChange({
            id: event.jobId,
            status: event.status.toLowerCase(),
            progress: event.progress ?? 0,
            completedChunks: event.completedChunks ?? 0,
            totalChunks: event.totalChunks ?? 0,
          });
        } catch {
          console.warn("[bff] ignored malformed job event");
        }
      },
      { noAck: true },
    );

    connected = true;
    console.log(`[bff] listening for job events on '${EXCHANGE}'`);
    connection.on("close", () => {
      connected = false;
      if (!stopped) setTimeout(() => void startJobEventListener(), RECONNECT_MS);
    });
    connection.on("error", (err: Error) => console.warn("[bff] rabbitmq error:", err.message));
  } catch (err) {
    connected = false;
    console.warn(`[bff] rabbitmq not reachable (${(err as Error).message}), retrying in ${RECONNECT_MS / 1000}s`);
    if (!stopped) setTimeout(() => void startJobEventListener(), RECONNECT_MS);
  }
};

export const stopJobEventListener = async () => {
  stopped = true;
  connected = false;
  await connection?.close().catch(() => undefined);
};
