package com.floyd.lottoptions.bff.client;

/**
 * Thrown when the Core API is unreachable or answers 503, such as when its results service is
 * down. The BFF answers 503 for it.
 */
public final class CoreUnavailableException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param detail why Core is unavailable: Core's problem detail, or a fallback when Core sent none
     */
    public CoreUnavailableException(String detail) {
        super(detail);
    }

    /**
     * @param detail why Core is unavailable
     * @param cause  the failed connection
     */
    public CoreUnavailableException(String detail, Throwable cause) {
        super(detail, cause);
    }
}
