import type { ErrorResponse, JobView } from "./shared.dto.js";

/**
 * POST /api/jobs?factor=4&mode=flow
 * Body: multipart/form-data with one "file" field. Options travel in the query string because the
 * body is streamed straight through to media-service without being parsed here.
 */
export namespace addJob {
  export interface query {
    factor?: string;
    mode?: string;
    preprocess?: string;
  }
  export interface response {
    message: string;
    job: JobView;
  }
  export type error = ErrorResponse;
}
