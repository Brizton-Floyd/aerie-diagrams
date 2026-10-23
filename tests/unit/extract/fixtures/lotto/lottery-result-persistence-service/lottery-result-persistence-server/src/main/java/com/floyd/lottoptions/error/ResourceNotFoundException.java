package com.floyd.lottoptions.error;

/** Thrown when a requested state or game has no persisted data. Maps to HTTP 404. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
