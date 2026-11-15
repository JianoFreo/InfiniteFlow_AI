package com.jianofreo.worker.dto.engine;

/** How one run of the Python engine ended. */
public record EngineResult(Status status, int framesDone, String outputPath, String error) {

    public enum Status { DONE, CANCELLED, FAILED }

    public static EngineResult done(int framesDone, String outputPath) {
        return new EngineResult(Status.DONE, framesDone, outputPath, null);
    }

    public static EngineResult cancelled() {
        return new EngineResult(Status.CANCELLED, 0, null, null);
    }

    public static EngineResult failed(String error) {
        return new EngineResult(Status.FAILED, 0, null, error);
    }
}
