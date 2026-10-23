package com.floyd.lottoptions.error;

/** Structured error body returned by {@link GlobalExceptionHandler}. */
public record ApiError(String timestamp, int status, String error, String message, String path) {
}
