package com.floyd.lottoptions.bff.controller;

import com.floyd.lottoptions.bff.client.CoreNotFoundException;
import com.floyd.lottoptions.bff.client.CoreUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

/**
 * Error contract of the BFF's {@code /ui} routes: a Core 404 answers 404, and a Core 503 or an
 * unreachable Core answers 503, each with an RFC 9457 {@link ProblemDetail} body whose detail
 * comes from {@link com.floyd.lottoptions.bff.client.CoreApiClient}.
 *
 * <p>Each body names its type, {@code about:blank}, as the BFF's error bodies always have:
 * Spring Framework 6 set that type by default, while Spring Framework 7 leaves it unset and
 * omits it from the body.</p>
 */
@RestControllerAdvice
public class CoreApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(CoreApiExceptionHandler.class);

    /** RFC 9457's type for a problem with no more meaning than its status code. */
    private static final URI ABOUT_BLANK = URI.create("about:blank");

    @ExceptionHandler(CoreNotFoundException.class)
    public ProblemDetail handleCoreNotFound(CoreNotFoundException ex) {
        log.info("Core API not found: {}", ex.getMessage());
        return problem(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(CoreUnavailableException.class)
    public ProblemDetail handleCoreUnavailable(CoreUnavailableException ex) {
        log.warn("Core API unavailable: {}", ex.getMessage(), ex.getCause());
        return problem(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(ABOUT_BLANK);
        return problem;
    }
}
