package com.floyd.lottoptions.core.domain.draw;

/**
 * Thrown when the draw-history source cannot answer: it is down or failing. The Core API
 * answers 503 for it.
 */
public final class DrawHistoryUnavailableException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param cause the source's own failure
     */
    public DrawHistoryUnavailableException(Throwable cause) {
        super("Draw history source failed: " + cause.getMessage(), cause);
    }
}
