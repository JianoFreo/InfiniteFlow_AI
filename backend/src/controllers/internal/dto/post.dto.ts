/**
 * POST /internal/job-events
 * Called by job-service after every job change. One call can carry several events.
 */
export namespace receiveJobEvents {
  /** Same fields as job-service's JobEvent (dto/event/JobEvent.java). */
  export interface jobEvent {
    jobId: number;
    status: string; // "PROCESSING", "COMPLETED"... or "DELETED"
    progress: number;
    completedChunks: number;
    totalChunks: number;
    ownerId: string; // "u:<userId>" or "g:<guestId>"
  }

  export type body = jobEvent[];

  export interface response {
    message: string;
    received: number;
  }

  export interface error {
    message: string;
  }
}
