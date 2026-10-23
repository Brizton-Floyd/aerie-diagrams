package com.floyd.lottoptions.bff.service;

import com.floyd.lottoptions.bff.assembler.PatternEdgeAssembler;
import com.floyd.lottoptions.bff.client.CoreApiClient;
import com.floyd.lottoptions.bff.viewmodel.PatternEdgeViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.DashboardResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Objects;

/**
 * Orchestration service for the walk-forward pattern edge detector endpoint (FR-015).
 *
 * <p>Issues exactly one Core API call per invocation via
 * {@link CoreApiClient#getDashboard(String, String)} and delegates all computation
 * to {@link PatternEdgeAssembler}. No domain logic lives here.</p>
 *
 * <p>The class is {@code final} and stateless; thread-safety is trivially guaranteed
 * (Effective Java Items 17, 19, 82). Constructor injection is used throughout; no
 * field {@code @Autowired} (Effective Java Item 5).</p>
 *
 * <p>No {@code block()} calls are made anywhere in the reactive chain - all operations
 * remain non-blocking (FR-015 Section 1.2 constraint (f)).</p>
 */
@Service
public final class PatternEdgeService {

    private static final Logger log = LoggerFactory.getLogger(PatternEdgeService.class);

    private final CoreApiClient coreApiClient;
    private final PatternEdgeAssembler patternEdgeAssembler;

    /**
     * Constructs a {@code PatternEdgeService} with its required collaborators.
     *
     * @param coreApiClient       reactive HTTP client for the Core API; must not be {@code null}
     * @param patternEdgeAssembler the pure walk-forward computation assembler; must not be {@code null}
     */
    public PatternEdgeService(CoreApiClient coreApiClient,
                              PatternEdgeAssembler patternEdgeAssembler) {
        this.coreApiClient = Objects.requireNonNull(coreApiClient, "coreApiClient must not be null");
        this.patternEdgeAssembler = Objects.requireNonNull(patternEdgeAssembler,
                "patternEdgeAssembler must not be null");
    }

    /**
     * Fetches the Core API payload and assembles the walk-forward pattern edge view model.
     *
     * <p>Issues exactly one Core API call per invocation (FR-015-SERVICE). Chains
     * {@code .map(response → patternEdgeAssembler.buildPatternEdge(safePatterns(response),
     * topN, DEFAULT_WARMUP_DRAWS))} - no {@code block()}.</p>
     *
     * @param state the lottery state code (e.g. {@code "TX"}); must not be {@code null}
     * @param game  the lottery game name (e.g. {@code "Cash Five"}); must not be {@code null}
     * @param topN  top-N fingerprints to include in the predicted set; must be &ge; 1
     * @return a {@link Mono} emitting the {@link PatternEdgeViewModel}; never emits {@code null}
     * @throws NullPointerException     if {@code state} or {@code game} is {@code null}
     * @throws IllegalArgumentException if {@code topN} is less than 1
     */
    public Mono<PatternEdgeViewModel> getPatternEdge(String state, String game, int topN) {
        Objects.requireNonNull(state, "state must not be null");
        Objects.requireNonNull(game, "game must not be null");
        if (topN < 1) {
            throw new IllegalArgumentException("topN must be >= 1, got: " + topN);
        }
        log.debug("Fetching pattern edge from Core API for state={} game={} topN={}", state, game, topN);
        return coreApiClient.getDashboard(state, game)
                .map(response -> patternEdgeAssembler.buildPatternEdge(
                        safePatterns(response), topN, PatternEdgeAssembler.DEFAULT_WARMUP_DRAWS));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Returns the draw result patterns from the response, or an empty list if
     * the response is {@code null} or the patterns list is {@code null}.
     *
     * @param response the Core API dashboard response
     * @return the draw result patterns; never {@code null}
     */
    private List<DrawResultPattern> safePatterns(DashboardResponse response) {
        List<DrawResultPattern> patterns = response.drawResultPatterns();
        return patterns != null ? patterns : List.of();
    }
}
