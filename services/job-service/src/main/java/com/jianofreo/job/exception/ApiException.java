package com.jianofreo.job.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** Throw this from services to answer with a real status code instead of a 500. */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    /** Optional machine-readable reason the frontend can react to, e.g. "quota_exceeded". */
    private final String code;

    public ApiException(HttpStatus status, String message) {
        this(status, null, message);
    }

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }
}
