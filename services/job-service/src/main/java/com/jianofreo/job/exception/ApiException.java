package com.jianofreo.job.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** Throw this from services to answer with a real status code instead of a 500. */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }
}
