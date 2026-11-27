import axios from "axios";
import { ENV } from "../config/env.js";
import type { ServiceChunk, ServiceJob } from "../controllers/job/dto/shared.dto.js";

export interface ServiceUser {
  id: number;
  email: string;
  name: string | null;
}

/** job-service (Spring Boot): owns job state. The BFF never touches its database directly. */
export const jobServiceApi = axios.create({ baseURL: ENV.JOB_SERVICE_URL, timeout: 15_000 });

export const jobService = {
  async createJob(body: { sourceMediaId: number; factor: number; mode: string; preprocess?: string; ownerId: string }) {
    const { data } = await jobServiceApi.post<ServiceJob>("/jobs", body);
    return data;
  },
  async listJobs(owner: string, limit: number, activeOnly: boolean) {
    const { data } = await jobServiceApi.get<ServiceJob[]>("/jobs", { params: { owner, limit, activeOnly } });
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
  async register(body: { email: string; password: string; name?: string }) {
    const { data } = await jobServiceApi.post<ServiceUser>("/auth/register", body);
    return data;
  },
  async login(body: { email: string; password: string }) {
    const { data } = await jobServiceApi.post<ServiceUser>("/auth/login", body);
    return data;
  },
  async getUser(id: number) {
    const { data } = await jobServiceApi.get<ServiceUser>(`/auth/users/${id}`);
    return data;
  },
  async claimJobs(from: string, to: string) {
    const { data } = await jobServiceApi.post<{ moved: number }>("/jobs/claim", { from, to });
    return data.moved;
  },
  async health() {
    const { data } = await jobServiceApi.get<{ status: string }>("/actuator/health", { timeout: 3_000 });
    return data.status;
  },
};
