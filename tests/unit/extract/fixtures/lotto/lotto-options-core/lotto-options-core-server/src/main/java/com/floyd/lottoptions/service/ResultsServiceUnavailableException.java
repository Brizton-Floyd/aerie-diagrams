package com.floyd.lottoptions.service;

/**
 * Thrown when the results service cannot answer: the connection fails or times out, or it
 * responds with a 5xx. The live Core API answers 503 for it.
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
