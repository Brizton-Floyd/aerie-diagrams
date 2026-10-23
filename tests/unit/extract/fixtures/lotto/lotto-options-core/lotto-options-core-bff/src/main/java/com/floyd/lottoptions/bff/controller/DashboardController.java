package com.floyd.lottoptions.bff.controller;

import com.floyd.lottoptions.bff.controller.dto.GenerateNumbersRequest;
import com.floyd.lottoptions.bff.service.DashboardService;
import com.floyd.lottoptions.bff.service.PatternEdgeService;
import com.floyd.lottoptions.bff.service.SmartGeneratorService;
import com.floyd.lottoptions.bff.viewmodel.DashboardAggregatesViewModel;
import com.floyd.lottoptions.bff.viewmodel.GeneratedNumbersViewModel;
import com.floyd.lottoptions.bff.viewmodel.MatrixPageViewModel;
import com.floyd.lottoptions.bff.viewmodel.PatternEdgeViewModel;
import com.floyd.lottoptions.bff.viewmodel.PositionTrendViewModel;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Objects;

/**
 * BFF endpoints for the Angular dashboard screen (Story 2, FR-006-F, ADR-0003).
 *
 * <p>Exposes five endpoints. The first three issue exactly one Core API call via
 * {@link DashboardService}; the fourth issues one Core API call via
 * {@link SmartGeneratorService}; the fifth issues one Core API call via
 * {@link PatternEdgeService}. The full Core API payload (~7.6 MB) is absorbed
 * inside the BFF; the browser receives slim, pre-assembled JSON responses:</p>
 * <ul>
 *   <li>{@code GET /ui/dashboard/{state}/{game}} - composite aggregates
 *       (frequency rollups + pattern analysis + probability panes + metadata)</li>
 *   <li>{@code GET /ui/dashboard/{state}/{game}/matrix} - paged draw-history matrix</li>
 *   <li>{@code GET /ui/dashboard/{state}/{game}/position-trend} - per-position OHLC trend</li>
 *   <li>{@code POST /ui/dashboard/{state}/{game}/generate} - Smart Generator number sets
 *       and prize-level statistics (FR-013)</li>
 *   <li>{@code GET /ui/dashboard/{state}/{game}/pattern-edge} - walk-forward out-of-sample
 *       pattern edge detector: does the top-N fingerprint prediction beat the combinatorial
 *       chance baseline? Returns edge, z-score, p-value, and verdict (FR-015)</li>
 * </ul>
 *
 * <p>This controller holds no domain logic - all orchestration is in
 * {@link DashboardService} and all projection is in the focused assembler layer.
 * The controller's sole responsibility is HTTP routing (Effective Java Item 17).</p>
 *
 * <p>Constructor injection is used throughout; no field {@code @Autowired}
 * (Effective Java Item 5).</p>
 */
@Tag(name = "Dashboard", description = "Dashboard screen data endpoints (Story 2, FR-006)")
@RestController
@RequestMapping("/ui")
public class DashboardController {

    private final DashboardService dashboardService;
    private final SmartGeneratorService smartGeneratorService;
    private final PatternEdgeService patternEdgeService;

    /**
     * Constructs a {@code DashboardController} with its required services.
     *
     * @param dashboardService      the orchestration service for the dashboard screen
     * @param smartGeneratorService the orchestration service for the Smart Generator endpoint
     * @param patternEdgeService    the orchestration service for the walk-forward pattern edge
     *                              detector endpoint (FR-015)
     */
    public DashboardController(DashboardService dashboardService,
                               SmartGeneratorService smartGeneratorService,
                               PatternEdgeService patternEdgeService) {
        this.dashboardService = Objects.requireNonNull(dashboardService, "dashboardService must not be null");
        this.smartGeneratorService = Objects.requireNonNull(smartGeneratorService,
                "smartGeneratorService must not be null");
        this.patternEdgeService = Objects.requireNonNull(patternEdgeService,
                "patternEdgeService must not be null");
    }

    /**
     * Returns the composite aggregates view model for the given lottery state and game.
     *
     * <p>Includes frequency rollups (zone + freq% + rangeFreq + drawsAgo), pattern analysis
     * (current + Top-5 + all), odd/even and high/low probability panes (5 columns each),
     * and metadata scalars (totalDraws, fieldMin, fieldMax, gameNumberCount, historyRange).
     * The matrix and position-trend data are fetched via their dedicated endpoints.</p>
     *
     * <p>Issues exactly one Core API call per invocation (FR-006-E). ADR-0003 - per-screen
     * view model, Story 2.</p>
     *
     * @param state the lottery state code (e.g. {@code "TX"})
     * @param game  the lottery game name (e.g. {@code "Cash Five"})
     * @return a {@link Mono} emitting the {@link DashboardAggregatesViewModel} with HTTP 200
     */
    @Operation(
            summary = "Get dashboard aggregates",
            description = "Returns pre-computed frequency rollups, pattern analysis, probability panes, " +
                    "and metadata scalars. Issues exactly one Core API call. Payload target < 100 KB.")
    @GetMapping("/dashboard/{state}/{game}")
    public Mono<DashboardAggregatesViewModel> getAggregates(
            @Parameter(description = "Lottery state code, e.g. TX")
            @PathVariable String state,
            @Parameter(description = "Lottery game name, e.g. Cash Five")
            @PathVariable String game) {
        return dashboardService.getAggregates(state, game);
    }

    /**
     * Returns a paged window of the draw-history matrix for the given state and game.
     *
     * <p>The matrix is the per-draw × per-number games-out grid (the desktop's
     * {@code numberColumnsTable × dateColumnTable}). Server-side paging keeps the payload
     * under 100 KB per page. Default page size is 50 rows; maximum is 100.</p>
     *
     * <p>{@code endIndex = -1} (default) is the sentinel meaning "newest page" - the
     * assembler resolves it to {@code totalDraws}. Angular navigates pages by adjusting
     * {@code endIndex} by ±{@code size}.</p>
     *
     * @param state    the lottery state code
     * @param game     the lottery game name
     * @param endIndex exclusive upper bound (0-based, oldest-first) into the full history;
     *                 {@code -1} = newest page
     * @param size     page size (1–100); defaults to 50
     * @return a {@link Mono} emitting the {@link MatrixPageViewModel}
     */
    @Operation(
            summary = "Get paged draw-history matrix",
            description = "Returns a paged window of the draw-history matrix (per-draw × per-number " +
                    "games-out grid). Use endIndex=-1 for the newest page. Navigate older pages by " +
                    "decrementing endIndex by size. Payload target < 100 KB per page.")
    @GetMapping("/dashboard/{state}/{game}/matrix")
    public Mono<MatrixPageViewModel> getMatrixPage(
            @Parameter(description = "Lottery state code, e.g. TX")
            @PathVariable String state,
            @Parameter(description = "Lottery game name, e.g. Cash Five")
            @PathVariable String game,
            @Parameter(description = "Exclusive upper bound (0-based) into the oldest-first draw list. " +
                    "-1 means newest page (resolves to totalDraws).")
            @RequestParam(defaultValue = "-1") int endIndex,
            @Parameter(description = "Page size (1–100). Clamped to maximum 100.")
            @RequestParam(defaultValue = "50") int size) {
        return dashboardService.getMatrixPage(state, game, endIndex, size);
    }

    /**
     * Returns the position-trend series for a specific draw position.
     *
     * <p>Buckets draws into periods of 5 and computes OHLC + MA5/10/20 for the games-out
     * value at the chosen 1-based draw position. Mirrors {@code PositionTrendService}
     * from the desktop but uses real frequency data (no {@code Math.random()}).</p>
     *
     * @param state    the lottery state code
     * @param game     the lottery game name
     * @param position 1-based draw position to analyse (default 1)
     * @param range    time range filter: {@code "30"}, {@code "60"}, {@code "90"}, or
     *                 {@code "all"} (default {@code "30"})
     * @return a {@link Mono} emitting the {@link PositionTrendViewModel}
     */
    @Operation(
            summary = "Get position-trend series",
            description = "Returns per-position games-out OHLC trend (periods-of-5), MA5/10/20, " +
                    "and analysis (hot/cold numbers, primary trend, insights). Real data only - " +
                    "no Math.random(). Payload target < 50 KB.")
    @GetMapping("/dashboard/{state}/{game}/position-trend")
    public Mono<PositionTrendViewModel> getPositionTrend(
            @Parameter(description = "Lottery state code, e.g. TX")
            @PathVariable String state,
            @Parameter(description = "Lottery game name, e.g. Cash Five")
            @PathVariable String game,
            @Parameter(description = "1-based draw position to analyse. Default 1.")
            @RequestParam(defaultValue = "1") int position,
            @Parameter(description = "Time range filter: 30 | 60 | 90 | all. Default 30.")
            @RequestParam(defaultValue = "30") String range) {
        return dashboardService.getPositionTrend(state, game, position, range);
    }

    /**
     * Generates lottery number sets for the given state and game using the Smart Generator.
     *
     * <p>Relays the generation request to the Core API endpoint
     * {@code POST /api/v1/analysis/generate/numbers} and returns a slim
     * {@link GeneratedNumbersViewModel} containing the generated sets, per-prize-level
     * statistics, total ticket count, and the estimated days to win the targeted prize level.
     * Delegates entirely to {@link SmartGeneratorService#generateNumbers} (FR-013-CONTROLLER).
     * Issues exactly one Core API call per invocation.</p>
     *
     * @param state   the lottery state code (e.g. {@code "TX"})
     * @param game    the lottery game name (e.g. {@code "Cash Five"})
     * @param request the generation parameters supplied by the Angular Smart Generator screen
     * @return a {@link Mono} emitting the {@link GeneratedNumbersViewModel} with HTTP 200
     */
    @Operation(
            summary = "Generate lottery numbers (Smart Generator)",
            description = "Relays a number-generation request to the Core API and returns " +
                    "generated ticket sets with prize-level statistics and estimated days to win. " +
                    "Issues exactly one Core API call. FR-013.")
    @PostMapping("/dashboard/{state}/{game}/generate")
    public Mono<GeneratedNumbersViewModel> generateNumbers(
            @Parameter(description = "Lottery state code, e.g. TX")
            @PathVariable String state,
            @Parameter(description = "Lottery game name, e.g. Cash Five")
            @PathVariable String game,
            @RequestBody GenerateNumbersRequest request) {
        return smartGeneratorService.generateNumbers(state, game, request);
    }

    /**
     * Returns the walk-forward pattern edge analysis for the given state and game.
     *
     * <p>Runs a strict out-of-sample walk-forward test: for each tested draw D (after a
     * warm-up window), the predicted set is the top-N most frequent fingerprints seen in
     * draws {@code [0, D)} exclusively - draw D is never included in its own prediction
     * window. Computes the combinatorial chance baseline (hypergeometric distribution) and
     * Poisson-binomial significance test (Abramowitz & Stegun normal approximation).
     * For a fair, independent lottery the correct result is always "No edge".
     * Issues exactly one Core API call per invocation. FR-015.</p>
     *
     * @param state the lottery state code (e.g. {@code "TX"})
     * @param game  the lottery game name (e.g. {@code "Cash Five"})
     * @param topN  number of top fingerprints to include in the predicted set (default 5)
     * @return a {@link Mono} emitting the {@link PatternEdgeViewModel} with HTTP 200
     */
    @Operation(
            summary = "Get pattern edge analysis",
            description = "Walk-forward out-of-sample test: does the top-N fingerprint prediction " +
                    "beat the combinatorial chance baseline? Returns edge, z-score, p-value, and verdict. " +
                    "FR-015. Issues exactly one Core API call.")
    @GetMapping("/dashboard/{state}/{game}/pattern-edge")
    public Mono<PatternEdgeViewModel> getPatternEdge(
            @Parameter(description = "Lottery state code, e.g. TX")
            @PathVariable String state,
            @Parameter(description = "Lottery game name, e.g. Cash Five")
            @PathVariable String game,
            @Parameter(description = "Top-N fingerprints to include in the predicted set. Default 5.")
            @RequestParam(defaultValue = "5") int topN) {
        return patternEdgeService.getPatternEdge(state, game, topN);
    }
}
