package com.floyd.lottoptions.controller;

import com.floyd.lottoptions.core.application.generate.GenerationStrategy;
import com.floyd.lottoptions.core.application.generate.UnknownGenerationStrategyException;
import com.floyd.lottoptions.core.domain.draw.DrawHistoryUnavailableException;
import com.floyd.lottoptions.core.domain.draw.UnknownGameException;
import com.floyd.lottoptions.core.server.adapter.web.BetslipController;
import com.floyd.lottoptions.core.server.adapter.web.CatalogController;
import com.floyd.lottoptions.core.server.adapter.web.DashboardController;
import com.floyd.lottoptions.core.server.adapter.web.DrawsController;
import com.floyd.lottoptions.core.server.adapter.web.GameOutRecommendationController;
import com.floyd.lottoptions.core.server.adapter.web.GenerateNumbersController;
import com.floyd.lottoptions.core.server.adapter.web.RangeAnalysisController;
import com.floyd.lottoptions.service.GameNotFoundException;
import com.floyd.lottoptions.service.ResultsServiceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Error contract of the live Core API: a missing game answers 404 and a results service that
 * is down or failing answers 503, each with an RFC 9457 {@link ProblemDetail} body. The
 * hexagonal core's adapters raise the domain's failures ({@link UnknownGameException},
 * {@link DrawHistoryUnavailableException}); the older services raise their own. A generate
 * request naming no generation strategy answers 400 with the accepted values.
 *
 * <p>Scoped to the live controllers, so the quarantined Desktop endpoints keep their behavior.</p>
 */
@RestControllerAdvice(assignableTypes = {
        CatalogController.class, DashboardController.class, DrawsController.class, GameOutController.class,
        GameOutRecommendationController.class, BetslipController.class, GenerateNumbersController.class,
        RangeAnalysisController.class})
public class LiveApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(LiveApiExceptionHandler.class);

    /** The 503 detail; the cause names internal URLs, so it is only logged. */
    static final String RESULTS_SERVICE_UNAVAILABLE_DETAIL = "The results service is unavailable";

    @ExceptionHandler({GameNotFoundException.class, UnknownGameException.class})
    public ProblemDetail handleGameNotFound(RuntimeException ex) {
        log.info("{}", ex.getMessage());
        return ProblemDetails.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(UnknownGenerationStrategyException.class)
    public ProblemDetail handleUnknownGenerationStrategy(UnknownGenerationStrategyException ex) {
        log.warn(ex.getMessage());
        ProblemDetail problem = ProblemDetails.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setProperty("acceptedValues", GenerationStrategy.acceptedWireNames());
        return problem;
    }

    @ExceptionHandler({ResultsServiceUnavailableException.class, DrawHistoryUnavailableException.class})
    public ProblemDetail handleResultsServiceUnavailable(RuntimeException ex) {
        log.warn("{}", ex.getMessage());
        return ProblemDetails.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, RESULTS_SERVICE_UNAVAILABLE_DETAIL);
    }
}
