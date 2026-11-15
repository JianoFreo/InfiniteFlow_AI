import type { ErrorResponse, JobDetailView, JobView } from "./shared.dto.js";

/** GET /api/jobs?limit=50&activeOnly=false */
export namespace getJobs {
  export interface query {
    limit?: string;
    activeOnly?: string;
  }
  export interface response {
    message: string;
    jobs: JobView[];
  }
  export type error = ErrorResponse;
}

/** GET /api/jobs/:job_id: job plus its chunk list (two job-service calls merged into one response) */
export namespace getJob {
  export interface params {
    job_id: string;
  }
  export interface response {
    message: string;
    job: JobDetailView;
  }
  export type error = ErrorResponse;
}

/** GET /api/jobs/:job_id/download?attachment=1: streams the video (Range supported, so the player can seek) */
export namespace downloadJob {
  export interface params {
    job_id: string;
  }
  export type error = ErrorResponse;
}
