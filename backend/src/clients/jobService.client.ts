import axios from "axios";
import { ENV } from "../config/env.js";
import type { ServiceChunk, ServiceJob } from "../controllers/job/dto/shared.dto.js";

/** job-service (Spring Boot): owns job state. The BFF never touches its database directly. */
export const jobServiceApi = axios.create({ baseURL: ENV.JOB_SERVICE_URL, timeout: 15_000 });

export const jobService = {
  async createJob(body: { sourceMediaId: number; factor: number; mode: string }) {
    const { data } = await jobServiceApi.post<ServiceJob>("/jobs", body);
    return data;
  },
  async listJobs(limit: number, activeOnly: boolean) {
    const { data } = await jobServiceApi.get<ServiceJob[]>("/jobs", { params: { limit, activeOnly } });
    return data;
  },
  async getJob(jobId: number) {
    const { data } = await jobServiceApi.get<ServiceJob>(`/jobs/${jobId}`);
    return data;
  },
  async getChunks(jobId: number) {
    const { data } = await jobServiceApi.get<ServiceChunk[]>(`/jobs/${jobId}/chunks`);
    return data;
  },
  async cancelJob(jobId: number) {
    const { data } = await jobServiceApi.post<ServiceJob>(`/jobs/${jobId}/cancel`);
    return data;
  },
  async deleteJob(jobId: number) {
    await jobServiceApi.delete(`/jobs/${jobId}`);
  },
  async health() {
    const { data } = await jobServiceApi.get<{ status: string }>("/actuator/health", { timeout: 3_000 });
    return data.status;
  },
};
