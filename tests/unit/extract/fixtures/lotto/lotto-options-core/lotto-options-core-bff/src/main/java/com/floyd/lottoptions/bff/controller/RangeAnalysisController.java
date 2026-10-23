package com.floyd.lottoptions.bff.controller;

import com.floyd.lottoptions.bff.controller.dto.RangeAnalysisRequest;
import com.floyd.lottoptions.bff.service.RangeAnalysisService;
import com.floyd.lottoptions.bff.viewmodel.RangeAnalysisViewModel;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Objects;

/**
 * BFF relay endpoint for the Angular range-analysis screen (Story 3, FR-016).
 *
 * <p>Exposes a single endpoint {@code POST /ui/range-analysis} that accepts a
 * {@link RangeAnalysisRequest} body, delegates entirely to {@link RangeAnalysisService},
 * and returns a slim {@link RangeAnalysisViewModel}. The Angular view (FR-017) must
 * never call the Core API directly - all traffic routes through this BFF endpoint
 * (architectural rule, consistent with FR-006 through FR-015).</p>
 *
 * <p>The endpoint uses POST (not GET) because the request carries a non-trivial body
 * (state, game, rangeSize, analysisType, maxDraws, includePerformanceMetrics,
 * drawPositions). This mirrors the Core's {@code POST /api/v1/analysis/range-analysis}
 * verb and preserves symmetry with FR-013
 * ({@code POST /ui/dashboard/{state}/{game}/generate}). See FR-016 ADR.</p>
 *
 * <p>This controller holds no domain logic - all orchestration is in
 * {@link RangeAnalysisService} and all projection is in the assembler layer
 * (Effective Java Item 17).</p>
 *
 * <p>Constructor injection is used throughout; no field {@code @Autowired}
 * (Effective Java Item 5). The class is {@code final} - not designed for extension
 * (Effective Java Items 17, 19).</p>
 */
@Tag(name = "Range Analysis", description = "Range-analysis screen data endpoint (Story 3, FR-016)")
@RestController
@RequestMapping("/ui")
public final class RangeAnalysisController {

    private final RangeAnalysisService rangeAnalysisService;

    /**
     * Constructs a {@code RangeAnalysisController} with its required service.
     *
     * @param rangeAnalysisService the orchestration service for the range-analysis endpoint;
     *                             must not be {@code null}
     */
    public RangeAnalysisController(RangeAnalysisService rangeAnalysisService) {
        this.rangeAnalysisService = Objects.requireNonNull(rangeAnalysisService,
                "rangeAnalysisService must not be null");
    }

    /**
     * Relays a range-analysis request to the Core API and returns a slim ViewModel.
     *
     * <p>Issues exactly one Core API call per invocation via
     * {@link RangeAnalysisService#getRangeAnalysis(RangeAnalysisRequest)}.
     * The BFF absorbs the full Core response and returns only the rendered fields
     * in a {@link RangeAnalysisViewModel}.</p>
     *
     * @param request the range-analysis parameters supplied by the Angular screen (FR-017)
     * @return a {@link Mono} emitting the {@link RangeAnalysisViewModel} with HTTP 200
     */
    @Operation(
            summary = "Run range analysis (relay to Core API)",
            description = "Relays a range-analysis request to the Core API's " +
                    "POST /api/v1/analysis/range-analysis endpoint and returns a slim " +
                    "RangeAnalysisViewModel. Issues exactly one Core API call. " +
                    "The Angular range-analysis screen (FR-017) must call this endpoint - " +
                    "never the Core API directly. FR-016, Story 3.")
    @PostMapping("/range-analysis")
    public Mono<RangeAnalysisViewModel> getRangeAnalysis(
            @RequestBody RangeAnalysisRequest request) {
        return rangeAnalysisService.getRangeAnalysis(request);
    }
}
