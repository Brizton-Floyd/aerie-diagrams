package com.floyd.lottoptions.legacy.desktop.shared.service;

/**
 * Thrown when the results service cannot answer: the connection fails or times out, or it
 * responds with a 5xx. Legacy's fork of Core's exception of the same name; no exception
 * handler maps it, so the quarantined endpoints keep their own error behavior.
 */
public final class ResultsServiceUnavailableException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param cause the failed call
     */
    public ResultsServiceUnavailableException(Throwable cause) {
        super("Results service call failed: " + cause.getMessage(), cause);
    }
}
