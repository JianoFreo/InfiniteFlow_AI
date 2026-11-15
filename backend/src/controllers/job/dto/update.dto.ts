import type { ErrorResponse, JobView } from "./shared.dto.js";

/** PATCH /api/jobs/:job_id/cancel */
export namespace cancelJob {
  export interface params {
    job_id: string;
  }
  export interface response {
    message: string;
    job: JobView;
  }
  export type error = ErrorResponse;
}
