import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";
import axios from "axios";
import { ENV } from "../config/env.js";
import type { ServiceMedia } from "../controllers/job/dto/shared.dto.js";

/** media-service (Spring Boot): owns the video files. */
export const mediaServiceApi = axios.create({ baseURL: ENV.MEDIA_SERVICE_URL });

export const mediaService = {
  /**
   * Pipes the browser's multipart upload straight to media-service. The file is never buffered
   * in Node's memory or written to the BFF's disk: a 2 GB upload costs the BFF a few KB of RAM.
   */
  async uploadStream(body: IncomingMessage, contentType: string, contentLength?: string) {
    const { data } = await mediaServiceApi.post<ServiceMedia>("/media", body, {
      headers: { "content-type": contentType, ...(contentLength ? { "content-length": contentLength } : {}) },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      maxRedirects: 0, // with redirects enabled axios buffers the body
      timeout: 0,
    });
    return data;
  },

  /** Streams the file back. Forwards the Range header so the browser's video player can seek. */
  async streamContent(mediaId: number, range?: string) {
    return mediaServiceApi.get<Readable>(`/media/${mediaId}/content`, {
      responseType: "stream",
      headers: range ? { range } : {},
      validateStatus: (status) => status < 500,
      timeout: 0,
    });
  },

  async deleteMedia(mediaId: number) {
    await mediaServiceApi.delete(`/media/${mediaId}`);
  },

  async health() {
    const { data } = await mediaServiceApi.get<{ status: string }>("/actuator/health", { timeout: 3_000 });
    return data.status;
  },
};
