package com.floyd.lottoptions.controller;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;

import java.net.URI;

/**
 * Builds the live Core API's RFC 9457 problem details. Each names its type, {@code about:blank},
 * as the API's error bodies always have: Spring Framework 6 set that type by default, while
 * Spring Framework 7 leaves it unset and omits it from the body.
 */
final class ProblemDetails {

    /** RFC 9457's type for a problem with no more meaning than its status code. */
    private static final URI ABOUT_BLANK = URI.create("about:blank");

    private ProblemDetails() {
        throw new AssertionError("no instances");
    }

    /** A problem detail of type {@code about:blank} with {@code status} and {@code detail}. */
    static ProblemDetail forStatusAndDetail(HttpStatusCode status, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(ABOUT_BLANK);
        return problem;
    }
}
