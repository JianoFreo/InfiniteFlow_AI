import type { ErrorResponse } from "./shared.dto.js";

/** DELETE /api/jobs/:job_id: removes the job, its chunks and both video files */
export namespace deleteJob {
  export interface params {
    job_id: string;
  }
  export interface response {
    message: string;
    job_id: number;
  }
  export type error = ErrorResponse;
}
