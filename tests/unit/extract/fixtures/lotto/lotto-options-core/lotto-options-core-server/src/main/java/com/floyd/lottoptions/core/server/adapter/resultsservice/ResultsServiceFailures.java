package com.floyd.lottoptions.core.server.adapter.resultsservice;

import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * Classifies failed results-service calls.
 */
public final class ResultsServiceFailures {

    private ResultsServiceFailures() {
    }

    /**
     * Whether a failed call means the results service is down or failing: the connection failed
     * or timed out ({@link WebClientRequestException}), or it answered with a 5xx.
     *
     * @param error the call's failure
     * @return {@code true} when the results service is unavailable
     */
    public static boolean isUnavailable(Throwable error) {
        return error instanceof WebClientRequestException
                || error instanceof WebClientResponseException response
                        && response.getStatusCode().is5xxServerError();
    }
}
