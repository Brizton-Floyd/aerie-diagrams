package com.floyd.lottoptions.core.server.adapter.web;

import com.floyd.lottoptions.core.contract.gameout.GameOutRecommendationRequest;
import com.floyd.lottoptions.core.contract.gameout.GameOutRecommendationResponse;
import com.floyd.lottoptions.core.contract.gameout.MultiStateRecommendationRequest;
import com.floyd.lottoptions.core.contract.gameout.MultiStateRecommendationResponse;
import com.floyd.lottoptions.core.domain.gameout.CoverageAnalysis;
import com.floyd.lottoptions.core.domain.gameout.GameOutRecommendation;
import com.floyd.lottoptions.core.domain.gameout.GameOutRequest;
import com.floyd.lottoptions.core.domain.gameout.HistoricalPerformance;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRecommendation;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRequest;
import com.floyd.lottoptions.core.domain.gameout.ProfitStatus;
import com.floyd.lottoptions.core.domain.gameout.RiskLevel;
import com.floyd.lottoptions.core.domain.gameout.WageringStrategy;

import java.time.LocalDate;

/**
 * Maps the game-out recommendation between the Core API's wire types and the domain's.
 */
final class GameOutRecommendationMapper {

    private static final String PLAY = "PLAY";
    private static final String SKIP = "SKIP";

    private GameOutRecommendationMapper() {
    }

    /**
     * @throws IllegalArgumentException if the request breaks a rule
     */
    static GameOutRequest toDomain(GameOutRecommendationRequest request) {
        return new GameOutRequest(request.getGameId(), request.getState(), request.getBetLevel(),
                request.getMaxGameOut(), request.getHPoolSize(), request.getMPoolSize(),
                Boolean.TRUE.equals(request.getIncludeHistoricalPerformance()), request.getPerformanceYear(),
                request.getPerformanceYears(), request.getStartingBalance(), request.getPoolSize(),
                Boolean.TRUE.equals(request.getAutoOptimizeGameOut()));
    }

    /**
     * @throws IllegalArgumentException if the request breaks a rule
     */
    static MultiStateRequest toDomain(MultiStateRecommendationRequest request) {
        return new MultiStateRequest(request.getState(), request.getBetLevel(), request.getMaxGameOut(),
                request.getHPoolSize(), request.getMPoolSize(), request.getAccountBalance(),
                request.getStartingBalance(),
                request.getRiskLevel() == null ? null : RiskLevel.valueOf(request.getRiskLevel().name()),
                Boolean.TRUE.equals(request.getIncludeHistoricalPerformance()), request.getPerformanceYears());
    }

    /**
     * @param withDailyPlays whether the replay lists its plays; a multi-state response carries
     *                       them only in its consolidated stats
     */
    static GameOutRecommendationResponse toResponse(GameOutRecommendation recommendation, boolean withDailyPlays) {
        GameOutRecommendationResponse.Metadata metadata = toResponse(recommendation.metadata());
        GameOutRecommendationResponse.HistoricalPerformance performance = recommendation.historicalPerformance() == null
                ? null : toResponse(recommendation.historicalPerformance(), withDailyPlays);
        GameOutRecommendation.Decision decision = recommendation.decision();

        if (decision instanceof GameOutRecommendation.CombinationPlay play) {
            return new GameOutRecommendationResponse(PLAY, recommendation.gameId(), recommendation.drawDate(),
                    play.betLevel(), play.prize(), play.pattern(), recommendation.gameOutValue(),
                    recommendation.maxGameOut(), play.pools(), play.combinations(), (long) play.combinations().size(),
                    play.totalCost(), play.prize(), null, metadata, performance, null, null, null, null);
        }
        if (decision instanceof GameOutRecommendation.PoolPlay play) {
            return new GameOutRecommendationResponse(PLAY, recommendation.gameId(), recommendation.drawDate(),
                    play.betLevel(), null, play.pattern(), recommendation.gameOutValue(), recommendation.maxGameOut(),
                    null, null, null, null, null, null, metadata, performance, play.poolNumbers(),
                    play.poolNumbers().size(), play.positionalBreakdown(),
                    play.coverageAnalysis() == null ? null : toResponse(play.coverageAnalysis()));
        }
        GameOutRecommendation.Skip skip = (GameOutRecommendation.Skip) decision;
        return new GameOutRecommendationResponse(SKIP, recommendation.gameId(), recommendation.drawDate(), null, null,
                null, recommendation.gameOutValue(), recommendation.maxGameOut(), null, null, null, null, null,
                skip.reason(), metadata, performance, null, null, null, null);
    }

    static MultiStateRecommendationResponse toResponse(MultiStateRecommendation recommendation) {
        MultiStateRecommendation.CapitalManagement capital = recommendation.capitalManagement();
        return new MultiStateRecommendationResponse(
                recommendation.state(),
                recommendation.betLevel(),
                recommendation.recommendedBetLevel(),
                recommendation.betLevelAdjustmentReason(),
                recommendation.accountBalance(),
                com.floyd.lottoptions.core.contract.gameout.RiskLevel.valueOf(recommendation.riskLevel().name()),
                recommendation.maxAllowedSpend(),
                recommendation.totalGamesAnalyzed(),
                recommendation.totalGamesQualified(),
                recommendation.totalGamesRecommended(),
                recommendation.totalGamesExcludedByBudget(),
                recommendation.recommendations().stream().map(game -> toResponse(game, false)).toList(),
                recommendation.aggregatedStats() == null ? null : toResponse(recommendation.aggregatedStats()),
                new MultiStateRecommendationResponse.CapitalManagement(capital.remainingBalance(),
                        capital.percentageUsed(),
                        capital.gamesExcludedByBudget().isEmpty() ? null
                                : capital.gamesExcludedByBudget().stream().map(GameOutRecommendationMapper::toResponse)
                                        .toList()),
                recommendation.message(),
                recommendation.wageringStrategy() == null ? null : toResponse(recommendation.wageringStrategy()),
                toResponse(recommendation.metadata()));
    }

    private static GameOutRecommendationResponse.Metadata toResponse(GameOutRecommendation.Metadata metadata) {
        return new GameOutRecommendationResponse.Metadata(metadata.trainingDraws(), metadata.lastDrawDate(),
                metadata.hPoolSize(), metadata.mPoolSize());
    }

    private static GameOutRecommendationResponse.HistoricalPerformance toResponse(HistoricalPerformance performance,
                                                                                  boolean withDailyPlays) {
        return new GameOutRecommendationResponse.HistoricalPerformance(
                performance.year(),
                performance.years(),
                performance.combinedStats(),
                performance.totalDraws(),
                performance.playsTaken(),
                performance.playsSkipped(),
                performance.playsWon(),
                performance.playsLost(),
                performance.winRate(),
                performance.totalCost(),
                performance.totalWinnings(),
                performance.netProfit(),
                performance.roi(),
                performance.startingBalance(),
                performance.currentBalance(),
                performance.peakBalance(),
                performance.lowestBalance(),
                performance.maxWinStreak(),
                performance.maxLossStreak(),
                performance.currentStreak(),
                performance.greenMonths(),
                performance.redMonths(),
                performance.monthlyBreakdown().stream().map(GameOutRecommendationMapper::toResponse).toList(),
                performance.yearlyBreakdown().stream().map(GameOutRecommendationMapper::toResponse).toList(),
                withDailyPlays
                        ? performance.dailyPlays().stream().map(GameOutRecommendationMapper::toResponse).toList()
                        : null);
    }

    private static GameOutRecommendationResponse.MonthlyStats toResponse(HistoricalPerformance.MonthlyStats month) {
        HistoricalPerformance.MonthlyTraps traps = month.traps();
        return new GameOutRecommendationResponse.MonthlyStats(month.month(), month.plays(), month.wins(),
                month.cost(), month.winnings(), month.profit(), month.status().name(),
                traps == null ? null : traps.fullTraps(),
                traps == null ? null : traps.minus1Traps(),
                traps == null ? null : traps.minus2Traps(),
                traps == null ? null : traps.fullTrapRate(),
                traps == null ? null : traps.minus1TrapRate(),
                traps == null ? null : traps.minus2TrapRate());
    }

    private static GameOutRecommendationResponse.YearlyStats toResponse(HistoricalPerformance.YearlyStats year) {
        return new GameOutRecommendationResponse.YearlyStats(year.year(), year.plays(), year.wins(), year.cost(),
                year.winnings(), year.profit(), year.winRate(), year.status().name());
    }

    private static GameOutRecommendationResponse.DailyPlayDetail toResponse(HistoricalPerformance.DailyPlay play) {
        return new GameOutRecommendationResponse.DailyPlayDetail(
                play.drawDate().toString(),
                play.trainingDataStartDate(),
                play.trainingDataEndDate(),
                play.trainingDataSize(),
                play.betLevel(),
                play.winningNumbers(),
                play.selectedPools(),
                play.totalCombinations(),
                play.playCost(),
                play.winnings(),
                play.profit(),
                play.result().name(),
                play.fullTraps(),
                play.minus1Traps(),
                play.minus2Traps(),
                play.bestMatch().name(),
                play.cumulativeCost(),
                play.cumulativePayout(),
                play.cumulativeProfit(),
                play.accountBalance(),
                play.roi());
    }

    private static GameOutRecommendationResponse.CoverageAnalysis toResponse(CoverageAnalysis coverage) {
        return new GameOutRecommendationResponse.CoverageAnalysis(coverage.totalDrawsAnalyzed(), coverage.fullTraps(),
                coverage.minus1Traps(), coverage.minus2Traps(), coverage.fullTrapRate(), coverage.minus1TrapRate(),
                coverage.minus2TrapRate());
    }

    private static MultiStateRecommendationResponse.AggregatedStats toResponse(
            MultiStateRecommendation.AggregatedStats stats) {
        MultiStateRecommendation.CombinedHistoricalPerformance combined = stats.combinedHistoricalPerformance();
        return new MultiStateRecommendationResponse.AggregatedStats(stats.totalCombinations(), stats.totalCost(),
                stats.totalExpectedPrizes(), stats.averageGameOutValue(),
                new MultiStateRecommendationResponse.CombinedHistoricalPerformance(combined.totalPlays(),
                        combined.totalWins(), combined.overallWinRate(), combined.totalCost(), combined.totalPayout(),
                        combined.netProfit(), combined.roi(), combined.greenMonths(), combined.redMonths(),
                        combined.yearlyBreakdown().stream().map(GameOutRecommendationMapper::toResponse).toList()));
    }

    private static MultiStateRecommendationResponse.YearlyPerformance toResponse(
            MultiStateRecommendation.YearlyPerformance year) {
        return new MultiStateRecommendationResponse.YearlyPerformance(year.year(), year.totalPlays(),
                year.totalWins(), year.winRate(), year.totalCost(), year.totalPayout(), year.netProfit(), year.roi(),
                year.greenMonths(), year.redMonths(),
                year.dailyPlayHistory().stream().map(GameOutRecommendationMapper::toResponse).toList(),
                year.monthlySummary().stream().map(GameOutRecommendationMapper::toResponse).toList());
    }

    private static MultiStateRecommendationResponse.ConsolidatedDailyResult toResponse(
            MultiStateRecommendation.ConsolidatedDailyResult day) {
        return new MultiStateRecommendationResponse.ConsolidatedDailyResult(
                day.drawDate().toString(),
                toStringOrNull(day.trainingDataStartDate()),
                toStringOrNull(day.trainingDataEndDate()),
                day.trainingDataSize(),
                day.gamesPlayed(),
                day.gamesWon(),
                day.totalCost(),
                day.totalWinnings(),
                day.totalProfit(),
                day.accountBalance(),
                day.betLevel(),
                day.riskLevel().name(),
                day.cumulativeCost(),
                day.cumulativePayout(),
                day.cumulativeProfit(),
                day.roi(),
                day.gamesDetails().stream().map(GameOutRecommendationMapper::toResponse).toList());
    }

    private static MultiStateRecommendationResponse.GamePlayDetail toResponse(
            MultiStateRecommendation.GamePlayDetail detail) {
        HistoricalPerformance.DailyPlay play = detail.play();
        return new MultiStateRecommendationResponse.GamePlayDetail(detail.gameName(), play.betLevel(),
                play.winningNumbers(), play.selectedPools(), play.totalCombinations(), play.playCost(),
                play.winnings(), play.profit(), play.result().name(),
                new MultiStateRecommendationResponse.MatchDetails(play.fullTraps(), play.minus1Traps(),
                        play.minus2Traps(), play.bestMatch().name()));
    }

    private static MultiStateRecommendationResponse.MonthlySummary toResponse(
            MultiStateRecommendation.MonthlySummary month) {
        return new MultiStateRecommendationResponse.MonthlySummary(month.month(), month.monthName(),
                month.totalPlays(), month.totalWins(), month.winRate(), month.monthlyCost(), month.monthlyPayout(),
                month.monthlyProfit(), month.cumulativeCost(), month.cumulativePayout(), month.cumulativeProfit(),
                month.roi(), month.startingBalance(), month.accountBalance(), summaryStatus(month.status()));
    }

    /** The combined monthly summary has always called a break-even month {@code NEUTRAL}. */
    private static String summaryStatus(ProfitStatus status) {
        return status == ProfitStatus.BREAK_EVEN ? "NEUTRAL" : status.name();
    }

    private static MultiStateRecommendationResponse.ExcludedGame toResponse(
            MultiStateRecommendation.ExcludedGame game) {
        return new MultiStateRecommendationResponse.ExcludedGame(game.gameId(), game.estimatedCost(),
                game.gameOutValue(), game.roi(), game.reason());
    }

    private static MultiStateRecommendationResponse.Metadata toResponse(MultiStateRecommendation.Metadata metadata) {
        return new MultiStateRecommendationResponse.Metadata(metadata.requestTimestamp(), metadata.analysisDate(),
                metadata.gamesExcludedByType(), metadata.gamesSkippedByThreshold());
    }

    private static MultiStateRecommendationResponse.WageringStrategy toResponse(WageringStrategy strategy) {
        WageringStrategy.ScenarioGuidance scenarios = strategy.scenarios();
        WageringStrategy.CapitalThresholds thresholds = strategy.capitalThresholds();
        WageringStrategy.BetLevelAdjustments adjustments = strategy.betLevelAdjustments();
        return new MultiStateRecommendationResponse.WageringStrategy(
                strategy.recommendedSequence(),
                strategy.sequencingRationale(),
                new MultiStateRecommendationResponse.ScenarioGuidance(scenarios.ifAllWin(), scenarios.ifFirstWins(),
                        scenarios.ifFirstLoses(), scenarios.ifFirstTwoLose(), scenarios.ifMajorityLose()),
                new MultiStateRecommendationResponse.CapitalThresholds(thresholds.stopLossBalance(),
                        thresholds.stopLossPercentage(), thresholds.scaleDownBalance(),
                        thresholds.scaleDownPercentage(), thresholds.breakEvenBalance()),
                new MultiStateRecommendationResponse.BetLevelAdjustments(adjustments.currentLevel(),
                        adjustments.scaleDownLevel(), adjustments.minimumLevel(), adjustments.scaleUpLevel(),
                        adjustments.scaleUpCondition()));
    }

    private static String toStringOrNull(LocalDate date) {
        return date == null ? null : date.toString();
    }
}
