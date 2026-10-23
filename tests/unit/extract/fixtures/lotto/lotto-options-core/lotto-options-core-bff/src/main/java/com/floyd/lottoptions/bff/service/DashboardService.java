package com.floyd.lottoptions.bff.service;

import com.floyd.lottoptions.bff.assembler.FrequencyRollupAssembler;
import com.floyd.lottoptions.bff.assembler.LatestDrawAssembler;
import com.floyd.lottoptions.bff.assembler.MatrixPageAssembler;
import com.floyd.lottoptions.bff.assembler.OddEvenHighLowAssembler;
import com.floyd.lottoptions.bff.assembler.PatternAnalysisAssembler;
import com.floyd.lottoptions.bff.assembler.PositionTrendAssembler;
import com.floyd.lottoptions.bff.assembler.SegmentsSummaryAssembler;
import com.floyd.lottoptions.bff.assembler.SumRangeSummaryAssembler;
import com.floyd.lottoptions.bff.client.CoreApiClient;
import com.floyd.lottoptions.bff.viewmodel.DashboardAggregatesViewModel;
import com.floyd.lottoptions.bff.viewmodel.HistoryRangeViewModel;
import com.floyd.lottoptions.bff.viewmodel.LatestDrawViewModel;
import com.floyd.lottoptions.bff.viewmodel.MatrixPageViewModel;
import com.floyd.lottoptions.bff.viewmodel.NumberFrequencyViewModel;
import com.floyd.lottoptions.bff.viewmodel.PositionTrendViewModel;
import com.floyd.lottoptions.bff.viewmodel.RangeRollupViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;
import com.floyd.lottoptions.core.contract.dashboard.DashboardResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Orchestration service for the dashboard screen (Story 2, FR-006-E, ADR-0003).
 *
 * <p>Exposes three public methods, each issuing exactly one Core API call, via
 * {@link CoreApiClient#getDashboard(String, String)} or, for the matrix,
 * {@link CoreApiClient#getDraws(String, String, int, int)}, and delegating all projection
 * to the focused assembler layer. No domain logic lives here.</p>
 *
 * <p>The class is {@code final} because it is not designed for extension
 * (Effective Java Items 17 and 19). Constructor injection is used throughout;
 * no field {@code @Autowired} (Effective Java Item 5).</p>
 *
 * <p>No {@code block()} calls are made anywhere in the reactive chain - all
 * operations remain non-blocking (FR-006 Section 1.1 constraint (a)).</p>
 */
@Service
public final class DashboardService {

    private static final Logger log = LoggerFactory.getLogger(DashboardService.class);

    private static final Set<String> VALID_RANGES = Set.of("30", "60", "90", "all");

    private final CoreApiClient coreApiClient;
    private final FrequencyRollupAssembler frequencyRollupAssembler;
    private final PatternAnalysisAssembler patternAnalysisAssembler;
    private final OddEvenHighLowAssembler oddEvenHighLowAssembler;
    private final MatrixPageAssembler matrixPageAssembler;
    private final PositionTrendAssembler positionTrendAssembler;
    private final LatestDrawAssembler latestDrawAssembler;
    private final SumRangeSummaryAssembler sumRangeSummaryAssembler;
    private final SegmentsSummaryAssembler segmentsSummaryAssembler;

    /**
     * Constructs a {@code DashboardService} with its required collaborators.
     *
     * @param coreApiClient              reactive HTTP client for the Core API
     * @param frequencyRollupAssembler   assembles frequency rollups + range rollups
     * @param patternAnalysisAssembler   assembles pattern analysis
     * @param oddEvenHighLowAssembler    assembles probability pane data
     * @param matrixPageAssembler        assembles paged matrix windows from Core's draw pages
     * @param positionTrendAssembler     assembles position-trend OHLC series
     * @param latestDrawAssembler        assembles the latest draw's ball results (FR-008-I)
     * @param sumRangeSummaryAssembler   assembles the sum-range distribution panel (FR-011-A)
     * @param segmentsSummaryAssembler   assembles the segments heat-map panel (FR-011-B)
     */
    public DashboardService(CoreApiClient coreApiClient,
                            FrequencyRollupAssembler frequencyRollupAssembler,
                            PatternAnalysisAssembler patternAnalysisAssembler,
                            OddEvenHighLowAssembler oddEvenHighLowAssembler,
                            MatrixPageAssembler matrixPageAssembler,
                            PositionTrendAssembler positionTrendAssembler,
                            LatestDrawAssembler latestDrawAssembler,
                            SumRangeSummaryAssembler sumRangeSummaryAssembler,
                            SegmentsSummaryAssembler segmentsSummaryAssembler) {
        this.coreApiClient = coreApiClient;
        this.frequencyRollupAssembler = frequencyRollupAssembler;
        this.patternAnalysisAssembler = patternAnalysisAssembler;
        this.oddEvenHighLowAssembler = oddEvenHighLowAssembler;
        this.matrixPageAssembler = matrixPageAssembler;
        this.positionTrendAssembler = positionTrendAssembler;
        this.latestDrawAssembler = latestDrawAssembler;
        this.sumRangeSummaryAssembler = sumRangeSummaryAssembler;
        this.segmentsSummaryAssembler = segmentsSummaryAssembler;
    }

    /**
     * Fetches the Core API payload and assembles the composite aggregates view model.
     *
     * <p>Composes {@link FrequencyRollupAssembler}, {@link PatternAnalysisAssembler},
     * {@link OddEvenHighLowAssembler}, {@link SumRangeSummaryAssembler}, and
     * {@link SegmentsSummaryAssembler} into a single
     * {@link DashboardAggregatesViewModel}.
     * Issues exactly one Core API call per invocation (FR-006-E).</p>
     *
     * @param state the lottery state code (e.g. {@code "TX"}); must not be {@code null}
     * @param game  the lottery game name (e.g. {@code "Cash Five"}); must not be {@code null}
     * @return a {@link Mono} emitting the {@link DashboardAggregatesViewModel}
     */
    public Mono<DashboardAggregatesViewModel> getAggregates(String state, String game) {
        Objects.requireNonNull(state, "state must not be null");
        Objects.requireNonNull(game, "game must not be null");
        log.debug("Fetching aggregates from Core API for state={} game={}", state, game);
        return coreApiClient.getDashboard(state, game)
                .map(response -> assembleAggregates(state, game, response));
    }

    /**
     * Fetches one page of draw history from the Core API and assembles a paged matrix window.
     *
     * <p>Issues exactly one Core API call per invocation (FR-006-E), for the page only.
     * Validates {@code size} in [1..100] before calling the Core API.</p>
     *
     * @param state    the lottery state code; must not be {@code null}
     * @param game     the lottery game name; must not be {@code null}
     * @param endIndex exclusive upper bound (0-based, oldest-first); -1 = newest page
     * @param size     page size (1–100)
     * @return a {@link Mono} emitting the {@link MatrixPageViewModel}
     * @throws IllegalArgumentException if size is outside [1..100]
     */
    public Mono<MatrixPageViewModel> getMatrixPage(String state, String game, int endIndex, int size) {
        Objects.requireNonNull(state, "state must not be null");
        Objects.requireNonNull(game, "game must not be null");
        if (size < 1 || size > MatrixPageAssembler.MAX_PAGE_SIZE) {
            throw new IllegalArgumentException(
                    "size must be in [1.." + MatrixPageAssembler.MAX_PAGE_SIZE + "], got: " + size);
        }
        log.debug("Fetching matrix page from Core API for state={} game={} endIndex={} size={}",
                state, game, endIndex, size);
        return coreApiClient.getDraws(state, game, endIndex, size)
                .map(matrixPageAssembler::buildMatrixPage);
    }

    /**
     * Fetches the Core API payload and assembles the position-trend view model.
     *
     * <p>Issues exactly one Core API call per invocation (FR-006-E).
     * Validates {@code position} >= 1 and {@code range} in {"30","60","90","all"}.</p>
     *
     * @param state    the lottery state code; must not be {@code null}
     * @param game     the lottery game name; must not be {@code null}
     * @param position 1-based draw position; must be >= 1
     * @param range    time range filter; must be "30", "60", "90", or "all"
     * @return a {@link Mono} emitting the {@link PositionTrendViewModel}
     * @throws IllegalArgumentException if position < 1 or range is invalid
     */
    public Mono<PositionTrendViewModel> getPositionTrend(
            String state, String game, int position, String range) {
        Objects.requireNonNull(state, "state must not be null");
        Objects.requireNonNull(game, "game must not be null");
        if (position < 1) {
            throw new IllegalArgumentException("position must be >= 1, got: " + position);
        }
        if (!VALID_RANGES.contains(range)) {
            throw new IllegalArgumentException(
                    "range must be one of {30, 60, 90, all}, got: " + range);
        }
        log.debug("Fetching position-trend from Core API for state={} game={} position={} range={}",
                state, game, position, range);
        return coreApiClient.getDashboard(state, game)
                .map(response -> {
                    List<DrawResultPattern> patterns = safePatterns(response);
                    return positionTrendAssembler.buildPositionTrend(patterns, position, range);
                });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private DashboardAggregatesViewModel assembleAggregates(
            String state, String game, DashboardResponse response) {

        List<DrawResultPattern> patterns = safePatterns(response);

        List<NumberFrequencyViewModel> freqRollups =
                frequencyRollupAssembler.buildFrequencyRollups(patterns);
        List<RangeRollupViewModel> rangeRollups =
                frequencyRollupAssembler.buildRangeRollups(freqRollups);

        var patternAnalysis = patternAnalysisAssembler.buildPatternAnalysis(patterns);
        var oddEvenSummary = oddEvenHighLowAssembler.buildOddEvenSummary(
                response.oddEvenPatterns() != null ? response.oddEvenPatterns() : java.util.Map.of());
        var highLowSummary = oddEvenHighLowAssembler.buildHighLowSummary(
                response.highLowPatterns() != null ? response.highLowPatterns() : java.util.Map.of());

        // FR-011-A: Sum-Range distribution
        var sumRangeSummary = sumRangeSummaryAssembler.buildSumRangeSummary(patterns);

        // FR-011-B: Segments heat-map
        var segmentsSummary = segmentsSummaryAssembler.buildSegmentsSummary(patterns);

        // Derive scalars from most-recent draw
        DrawResultPattern latest = patterns.isEmpty() ? null : patterns.get(patterns.size() - 1);
        int fieldMin = deriveFieldMin(latest);
        int fieldMax = deriveFieldMax(latest);
        int gameNumberCount = deriveGameNumberCount(latest);

        // History range
        List<String> dates = response.historyBeginAndEndDates();
        HistoryRangeViewModel historyRange = (dates != null && dates.size() >= 2)
                ? new HistoryRangeViewModel(dates.get(0), dates.get(1))
                : new HistoryRangeViewModel("", "");

        // Latest draw balls - reuses the same 'patterns' list already in scope (FR-008-J)
        Optional<LatestDrawViewModel> latestDraw = latestDrawAssembler.buildLatestDraw(patterns);

        return new DashboardAggregatesViewModel(
                state,
                game,
                response.gameFormat() != null ? response.gameFormat() : "",
                response.totalDraws(),
                fieldMin,
                fieldMax,
                gameNumberCount,
                historyRange,
                freqRollups,
                rangeRollups,
                patternAnalysis,
                oddEvenSummary,
                highLowSummary,
                latestDraw,
                sumRangeSummary,
                segmentsSummary
        );
    }

    private List<DrawResultPattern> safePatterns(DashboardResponse response) {
        List<DrawResultPattern> patterns = response.drawResultPatterns();
        return patterns != null ? patterns : List.of();
    }

    private int deriveFieldMin(DrawResultPattern pattern) {
        if (pattern == null || pattern.lotteryNumbers() == null) return 1;
        return pattern.lotteryNumbers().stream()
                .mapToInt(LotteryNumber::number)
                .min().orElse(1);
    }

    private int deriveFieldMax(DrawResultPattern pattern) {
        if (pattern == null || pattern.lotteryNumbers() == null) return 35;
        return pattern.lotteryNumbers().stream()
                .mapToInt(LotteryNumber::number)
                .max().orElse(35);
    }

    private int deriveGameNumberCount(DrawResultPattern pattern) {
        if (pattern == null || pattern.lotteryNumbers() == null) return 0;
        return (int) pattern.lotteryNumbers().stream()
                .filter(ln -> ln.gamesOut() == 0)
                .count();
    }
}
