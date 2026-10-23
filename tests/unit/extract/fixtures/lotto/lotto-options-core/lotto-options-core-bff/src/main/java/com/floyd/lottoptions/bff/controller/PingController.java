package com.floyd.lottoptions.bff.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.floyd.lottoptions.bff.viewmodel.PingViewModel;

import reactor.core.publisher.Mono;

/**
 * Infrastructure health endpoint for the BFF.
 *
 * <p>This controller holds no domain logic. It exists for two purposes:
 * <ol>
 *   <li>Proving that the BFF module is wired and reachable.</li>
 *   <li>Establishing the per-screen view-model pattern: every BFF endpoint
 *       returns exactly one immutable view model record serialized as a JSON
 *       object.</li>
 * </ol>
 */
@RestController
@RequestMapping("/ui")
public class PingController {

    /**
     * Returns a trivial {@link PingViewModel} confirming the BFF is reachable.
     *
     * <p>This endpoint holds no domain logic and makes no calls to the Core API.
     * It returns a fixed {@link PingViewModel} with {@code status="ok"} and
     * {@code message="BFF is alive"}. The JSON object shape - not a bare string -
     * sets the pattern that all subsequent BFF view models must follow.</p>
     *
     * @return a {@link Mono} emitting {@code {"status":"ok","message":"BFF is alive"}}
     *         with HTTP 200 and {@code Content-Type: application/json}
     */
    @GetMapping("/ping")
    public Mono<PingViewModel> ping() {
        return Mono.just(new PingViewModel("ok", "BFF is alive"));
    }
}
