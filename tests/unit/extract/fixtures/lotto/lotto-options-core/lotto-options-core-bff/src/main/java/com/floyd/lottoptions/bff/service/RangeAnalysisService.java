package com.floyd.lottoptions.bff.service;

import com.floyd.lottoptions.bff.assembler.RangeAnalysisAssembler;
import com.floyd.lottoptions.bff.client.CoreApiClient;
import com.floyd.lottoptions.bff.controller.dto.RangeAnalysisRequest;
import com.floyd.lottoptions.bff.viewmodel.RangeAnalysisViewModel;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest.AnalysisType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Objects;

/**
 * Orchestration service for the BFF range-analysis relay endpoint (FR-016-E).
 *
 * <p>Translates the BFF-side {@link RangeAnalysisRequest} DTO into a Core API
 * {@code com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest}, issues <strong>exactly one</strong>
 * Core API call per invocation via {@link CoreApiClient#getRangeAnalysis}, and delegates
 * all response projection to {@link RangeAnalysisAssembler}. No domain logic lives here
 * (FR-016 Section 1.2 constraint (j) - the BFF is a pure relay/slimmer).</p>
 *
 * <p>ADR - single-Core-call-per-BFF-call: this service must never issue more than one
 * call to the Core API per invocation. All transformation (BFF DTO → Core request) happens
 * before the call; all projection (Core response → ViewModel) happens in the assembler
 * after the call.</p>
 *
 * <p>This class is {@code final} and stateless (Effective Java Items 17, 19, 82).
 * Constructor injection is used throughout; no field {@code @Autowired}
 * (Effective Java Item 5). No {@code block()} calls - all operations remain non-blocking.</p>
 *
 * <p>The BFF {@code AnalysisType} enum is bridged to the Core enum by name via
 * {@link Enum#valueOf(Class, String)}. Both enums declare the same constants
 * ({@code ACTUAL}, {@code DELTA}, {@code DELTA_SORTED}), so the mapping is safe as long
 * as the contract is not extended without also updating the BFF DTO enum.</p>
 */
@Service
public final class RangeAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(RangeAnalysisService.class);

    private final CoreApiClient coreApiClient;
    private final RangeAnalysisAssembler rangeAnalysisAssembler;

    /**
     * Constructs a {@code RangeAnalysisService} with its required collaborators.
     *
     * @param coreApiClient         reactive HTTP client for the Core API; must not be {@code null}
     * @param rangeAnalysisAssembler assembler that projects the Core response to ViewModel;
     *                               must not be {@code null}
     */
    public RangeAnalysisService(CoreApiClient coreApiClient,
                                RangeAnalysisAssembler rangeAnalysisAssembler) {
        this.coreApiClient = Objects.requireNonNull(coreApiClient,
                "coreApiClient must not be null");
        this.rangeAnalysisAssembler = Objects.requireNonNull(rangeAnalysisAssembler,
                "rangeAnalysisAssembler must not be null");
    }

    /**
     * Validates the BFF request, converts it to the Core API contract's request, issues exactly one
     * Core API call, and maps the response through the assembler.
     *
     * <p>Validation performed here (layered defence, no duplication with the Core):
     * <ul>
     *   <li>{@code request} non-null</li>
     *   <li>{@code rangeSize > 0}</li>
     *   <li>{@code analysisType} non-null</li>
     * </ul>
     * Other field validation is delegated to the Core, which calls
     * {@code RangeAnalysisRequest.isValid()} and returns HTTP 400 if invalid.</p>
     *
     * <p>{@code maxDraws} is relayed to the Core unchanged. {@code null} or {@code 0} means
     * "all available draws" - this value is NEVER hardcoded or defaulted in this layer
     * (FR-016-B, FR-016-E).</p>
     *
     * @param request the BFF-side range-analysis request; must not be {@code null}
     * @return a {@link Mono} emitting the {@link RangeAnalysisViewModel}; never emits {@code null}
     * @throws NullPointerException     if {@code request} is {@code null}
     * @throws IllegalArgumentException if {@code rangeSize} is not greater than zero
     * @throws IllegalArgumentException if {@code analysisType} is {@code null}
     */
    public Mono<RangeAnalysisViewModel> getRangeAnalysis(RangeAnalysisRequest request) {
        Objects.requireNonNull(request, "request must not be null");
        if (request.rangeSize() <= 0) {
            throw new IllegalArgumentException(
                    "rangeSize must be > 0, got: " + request.rangeSize());
        }
        if (request.analysisType() == null) {
            throw new IllegalArgumentException("analysisType must not be null");
        }

        com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest coreRequest = toCoreRequest(request);

        log.debug("Forwarding range-analysis request to Core API: state={} game={} " +
                  "rangeSize={} analysisType={} maxDraws={}",
                request.lotteryState(), request.lotteryGame(),
                request.rangeSize(), request.analysisType(), request.maxDraws());

        return coreApiClient.getRangeAnalysis(coreRequest)
                .map(rangeAnalysisAssembler::assemble);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Converts the BFF-side {@link RangeAnalysisRequest} DTO to the Core API contract's
     * {@code com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest}.
     *
     * <p>The BFF {@link RangeAnalysisRequest.AnalysisType} enum is bridged to the Core enum
     * by name via {@link Enum#valueOf(Class, String)}. Both enums declare the identical
     * constants ({@code ACTUAL}, {@code DELTA}, {@code DELTA_SORTED}).</p>
     *
     * <p>{@code maxDraws} is relayed unchanged - never hardcoded.</p>
     *
     * @param bffRequest the validated BFF request; must not be {@code null}
     * @return the equivalent Core API request
     */
    private com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest toCoreRequest(
            RangeAnalysisRequest bffRequest) {
        AnalysisType coreAnalysisType = Enum.valueOf(
                AnalysisType.class, bffRequest.analysisType().name());

        return new com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest(
                bffRequest.lotteryState(),
                bffRequest.lotteryGame(),
                bffRequest.rangeSize(),
                bffRequest.drawPositions(),
                coreAnalysisType,
                bffRequest.maxDraws(),
                bffRequest.includePerformanceMetrics()
        );
    }
}
