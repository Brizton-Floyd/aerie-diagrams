package com.floyd.lottoptions.core.application.gameout;

import com.floyd.lottoptions.core.domain.catalog.GameCatalogSource;
import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.draw.DrawHistorySource;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.core.domain.gameout.CombinationGenerator;
import com.floyd.lottoptions.core.domain.gameout.GameOutRecommendation;
import com.floyd.lottoptions.core.domain.gameout.HistoricalPerformanceCalculator;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRecommendation;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRequest;
import com.floyd.lottoptions.core.domain.gameout.PositionalPatternEngine;
import com.floyd.lottoptions.core.domain.gameout.SelectedGame;
import com.floyd.lottoptions.core.domain.gameout.WageringStrategy;
import com.floyd.lottoptions.core.domain.gameout.WageringStrategyCalculator;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Use case: recommend which of a state's digit games to play on their next draws, within the
 * share of the account the risk level allows.
 *
 * <p>Each eligible game (a digit game of 3 to 5 numbers) gets its own {@link RecommendGameOut}
 * recommendation. The PLAY games are ranked by priority, 60% ROI and 40% game-out value, and
 * taken in that order while they fit the budget. A game whose history cannot be read or
 * recommended is left out rather than failing the whole recommendation.</p>
 */
public final class RecommendMultiState {

    /** A digit game draws from at most this many numbers per position. */
    private static final int MAX_DIGIT_NUMBER_RANGE = 10;
    private static final int MIN_ELIGIBLE_GAME_SIZE = 3;
    private static final int MAX_ELIGIBLE_GAME_SIZE = 5;

    private final GameCatalogSource catalogSource;
    private final DrawHistorySource drawHistorySource;
    private final RecommendGameOut recommendGameOut;
    private final Clock clock;
    private final PositionalPatternEngine positionalPatternEngine = new PositionalPatternEngine();
    private final WageringStrategyCalculator wageringStrategyCalculator = new WageringStrategyCalculator();
    private final HistoricalPerformanceCalculator historicalPerformanceCalculator;

    /**
     * @param catalogSource     where a state's games are listed
     * @param drawHistorySource where draw histories are read from, to judge each game's eligibility
     * @param recommendGameOut  the single-game recommendation each eligible game gets
     * @param clock             supplies the recommendation's timestamp and analysis date
     */
    public RecommendMultiState(GameCatalogSource catalogSource, DrawHistorySource drawHistorySource,
                               RecommendGameOut recommendGameOut, Clock clock) {
        this.catalogSource = Objects.requireNonNull(catalogSource, "catalogSource");
        this.drawHistorySource = Objects.requireNonNull(drawHistorySource, "drawHistorySource");
        this.recommendGameOut = Objects.requireNonNull(recommendGameOut, "recommendGameOut");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.historicalPerformanceCalculator = new HistoricalPerformanceCalculator(
            positionalPatternEngine, new CombinationGenerator(), wageringStrategyCalculator, clock);
    }

    /**
     * Recommends a state's games.
     *
     * @param request the state and the recommendation's settings
     * @return the recommendation
     * @throws IllegalArgumentException if the catalog source answered without the state's games
     */
    public MultiStateRecommendation recommend(MultiStateRequest request) {
        BigDecimal recommendedBetLevel = wageringStrategyCalculator.calculateRecommendedBetLevel(
            request.accountBalance());
        BigDecimal actualBetLevel = request.betLevel();
        String betLevelAdjustmentReason;

        if (actualBetLevel.compareTo(recommendedBetLevel) > 0) {
            betLevelAdjustmentReason = String.format(
                "WARNING: Requested bet level ($%s) exceeds recommended level ($%s) for account balance $%s. " +
                "Consider reducing bet level to preserve capital and extend playing sessions.",
                actualBetLevel, recommendedBetLevel, request.accountBalance());
        } else if (actualBetLevel.compareTo(recommendedBetLevel) < 0) {
            betLevelAdjustmentReason = String.format(
                "INFO: You could increase bet level to $%s based on your account balance ($%s) and %s risk tolerance.",
                recommendedBetLevel, request.accountBalance(), request.riskLevel());
        } else {
            betLevelAdjustmentReason = String.format(
                "Bet level ($%s) is optimal for your account balance ($%s) and %s risk tolerance.",
                actualBetLevel, request.accountBalance(), request.riskLevel());
        }

        BigDecimal maxAllowedSpend = request.accountBalance()
            .multiply(BigDecimal.valueOf(request.riskLevel().riskFactor()))
            .setScale(2, RoundingMode.HALF_UP);

        List<String> gameNames = catalogSource.loadGameNames(request.state())
            .orElseThrow(() -> new IllegalArgumentException("No games found for state: " + request.state()));

        List<String> eligibleGames = new ArrayList<>();
        for (String gameName : gameNames) {
            if (isEligible(new GameId(request.state(), gameName))) {
                eligibleGames.add(gameName);
            }
        }

        List<RankedRecommendation> qualifiedGames = new ArrayList<>();
        List<String> skippedGames = new ArrayList<>();

        for (String gameName : eligibleGames) {
            try {
                GameOutRecommendation recommendation = recommendGameOut.recommend(request.forGame(gameName));

                if (recommendation.isPlay()) {
                    double roi = historicalPerformanceCalculator.calculateROI(recommendation);
                    double priorityScore = (roi * 0.6) + (recommendation.gameOutValue() * 0.4);

                    qualifiedGames.add(new RankedRecommendation(recommendation, roi, priorityScore));
                } else {
                    skippedGames.add(gameName);
                }
            } catch (RuntimeException e) {
                skippedGames.add(gameName);
            }
        }

        qualifiedGames.sort((g1, g2) -> Double.compare(g2.priorityScore, g1.priorityScore));

        List<GameOutRecommendation> selectedGames = new ArrayList<>();
        List<MultiStateRecommendation.ExcludedGame> excludedGames = new ArrayList<>();
        BigDecimal totalSpent = BigDecimal.ZERO;

        for (RankedRecommendation gameMetrics : qualifiedGames) {
            GameOutRecommendation game = gameMetrics.recommendation;
            BigDecimal gameCost = costOf(game);

            if (totalSpent.add(gameCost).compareTo(maxAllowedSpend) <= 0) {
                selectedGames.add(game);
                totalSpent = totalSpent.add(gameCost);
            } else {
                excludedGames.add(new MultiStateRecommendation.ExcludedGame(game.gameId(), gameCost,
                    game.gameOutValue(), gameMetrics.roi, "Insufficient budget after higher priority games"));
            }
        }

        MultiStateRecommendation.AggregatedStats aggregatedStats = null;
        if (!selectedGames.isEmpty()) {
            aggregatedStats = historicalPerformanceCalculator.calculateAggregatedStats(selectedGames, request);
        }

        MultiStateRecommendation.CapitalManagement capitalManagement = new MultiStateRecommendation.CapitalManagement(
            request.accountBalance().subtract(totalSpent),
            totalSpent.divide(request.accountBalance(), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100)).doubleValue(),
            excludedGames);

        String message = null;
        if (selectedGames.isEmpty()) {
            if (qualifiedGames.isEmpty()) {
                message = "No games currently meet the PLAY criteria (game-out threshold)";
            } else {
                message = "Insufficient funds: All qualified games exceed available budget";
            }
        }

        List<String> filteredOutGames = gameNames.stream()
            .filter(game -> !eligibleGames.contains(game))
            .collect(Collectors.toList());

        MultiStateRecommendation.Metadata metadata = new MultiStateRecommendation.Metadata(
            Instant.now(clock), LocalDate.now(clock).plusDays(1), filteredOutGames, skippedGames);

        WageringStrategy wageringStrategy = null;
        if (!selectedGames.isEmpty()) {
            wageringStrategy = wageringStrategyCalculator.calculateWageringStrategy(
                selectedGames.stream()
                    .map(game -> new SelectedGame(game.gameId(), costOf(game)))
                    .toList(),
                request.accountBalance(), request.betLevel());
        }

        return new MultiStateRecommendation(
            request.state(),
            actualBetLevel,
            recommendedBetLevel,
            betLevelAdjustmentReason,
            request.accountBalance(),
            request.riskLevel(),
            maxAllowedSpend,
            eligibleGames.size(),
            qualifiedGames.size(),
            selectedGames.size(),
            excludedGames.size(),
            selectedGames,
            aggregatedStats,
            capitalManagement,
            wageringStrategy,
            message,
            metadata);
    }

    /**
     * Whether a game is a digit game of 3 to 5 numbers, by its name and its latest draws. A game
     * whose history cannot be read, or has no draws, is not.
     */
    private boolean isEligible(GameId game) {
        Optional<DrawHistory> history;
        try {
            history = drawHistorySource.load(game);
        } catch (RuntimeException e) {
            return false;
        }
        if (history.isEmpty() || history.get().isEmpty()) {
            return false;
        }

        int maxNumber = positionalPatternEngine.detectMaxNumberRange(game.game());
        int gameSize = positionalPatternEngine.detectGameSize(
            history.get().oldestFirst().stream()
                .map(Draw::numbers)
                .filter(numbers -> !numbers.isEmpty())
                .collect(Collectors.toList()),
            game.game());

        return maxNumber <= MAX_DIGIT_NUMBER_RANGE
            && gameSize >= MIN_ELIGIBLE_GAME_SIZE && gameSize <= MAX_ELIGIBLE_GAME_SIZE;
    }

    /** What playing a recommended game costs; a large-pool play has no cost. */
    private static BigDecimal costOf(GameOutRecommendation game) {
        return game.combinationPlay().map(GameOutRecommendation.CombinationPlay::totalCost).orElse(BigDecimal.ZERO);
    }

    private static final class RankedRecommendation {
        final GameOutRecommendation recommendation;
        final double roi;
        final double priorityScore;

        RankedRecommendation(GameOutRecommendation recommendation, double roi, double priorityScore) {
            this.recommendation = recommendation;
            this.roi = roi;
            this.priorityScore = priorityScore;
        }
    }
}
