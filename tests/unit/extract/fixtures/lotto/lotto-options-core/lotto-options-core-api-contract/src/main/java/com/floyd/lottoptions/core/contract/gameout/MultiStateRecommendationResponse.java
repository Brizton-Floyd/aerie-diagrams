package com.floyd.lottoptions.core.contract.gameout;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Response body of {@code POST /api/v1/gameout/recommendation/multi-state}: the PLAY games of one
 * state that fit the budget, highest priority first, with the money management to play them by.
 * Absent properties are left out.
 *
 * @param state                      the state's name
 * @param betLevel                   the requested stake per combination
 * @param recommendedBetLevel        the stake the account balance supports
 * @param betLevelAdjustmentReason   how the requested stake compares with the recommended one
 * @param accountBalance             the money available
 * @param riskLevel                  the requested risk level
 * @param maxAllowedSpend            the most the play may spend
 * @param totalGamesAnalyzed         the games eligible for game-out
 * @param totalGamesQualified        the eligible games with a PLAY decision
 * @param totalGamesRecommended      the qualified games that fit the budget
 * @param totalGamesExcludedByBudget the qualified games that did not
 * @param recommendations            the recommended games, highest priority first
 * @param aggregatedStats            the recommended games' totals, when there are any
 * @param capitalManagement          what the play leaves of the balance
 * @param message                    why nothing is recommended, when nothing is
 * @param wageringStrategy           how to play the recommended games, when there are any
 * @param metadata                   when the recommendation was made and which games it left out
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MultiStateRecommendationResponse(
        String state,
        BigDecimal betLevel,
        BigDecimal recommendedBetLevel,
        String betLevelAdjustmentReason,
        BigDecimal accountBalance,
        RiskLevel riskLevel,
        BigDecimal maxAllowedSpend,
        Integer totalGamesAnalyzed,
        Integer totalGamesQualified,
        Integer totalGamesRecommended,
        Integer totalGamesExcludedByBudget,
        List<GameOutRecommendationResponse> recommendations,
        AggregatedStats aggregatedStats,
        CapitalManagement capitalManagement,
        String message,
        WageringStrategy wageringStrategy,
        Metadata metadata) {

    /** How to play the recommended games. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record WageringStrategy(
            List<String> recommendedSequence,
            String sequencingRationale,
            ScenarioGuidance scenarios,
            CapitalThresholds capitalThresholds,
            BetLevelAdjustments betLevelAdjustments) {
    }

    /** What to do after each outcome of the play. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ScenarioGuidance(
            String ifAllWin,
            String ifFirstWins,
            String ifFirstLoses,
            String ifFirstTwoLose,
            String ifMajorityLose) {
    }

    /** The balances to stop or scale down at. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CapitalThresholds(
            BigDecimal stopLossBalance,
            Double stopLossPercentage,
            BigDecimal scaleDownBalance,
            Double scaleDownPercentage,
            BigDecimal breakEvenBalance) {
    }

    /** The bet levels to move between. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record BetLevelAdjustments(
            BigDecimal currentLevel,
            BigDecimal scaleDownLevel,
            BigDecimal minimumLevel,
            BigDecimal scaleUpLevel,
            String scaleUpCondition) {
    }

    /** The recommended games' totals. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AggregatedStats(
            Long totalCombinations,
            BigDecimal totalCost,
            BigDecimal totalExpectedPrizes,
            Double averageGameOutValue,
            CombinedHistoricalPerformance combinedHistoricalPerformance) {
    }

    /** The recommended games' replays combined. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CombinedHistoricalPerformance(
            Integer totalPlays,
            Integer totalWins,
            Double overallWinRate,
            BigDecimal totalCost,
            BigDecimal totalPayout,
            BigDecimal netProfit,
            Double roi,
            Integer greenMonths,
            Integer redMonths,
            List<YearlyPerformance> yearlyBreakdown) {
    }

    /** One year of the combined replays. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record YearlyPerformance(
            Integer year,
            Integer totalPlays,
            Integer totalWins,
            Double winRate,
            BigDecimal totalCost,
            BigDecimal totalPayout,
            BigDecimal netProfit,
            Double roi,
            Integer greenMonths,
            Integer redMonths,
            List<ConsolidatedDailyResult> dailyPlayHistory,
            List<MonthlySummary> monthlySummary) {
    }

    /** Every recommended game's play on one draw date. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ConsolidatedDailyResult(
            String drawDate,
            String trainingDataStartDate,
            String trainingDataEndDate,
            Integer trainingDataSize,
            Integer gamesPlayed,
            Integer gamesWon,
            BigDecimal totalCost,
            BigDecimal totalWinnings,
            BigDecimal totalProfit,
            BigDecimal accountBalance,
            BigDecimal betLevel,
            String riskLevel,
            BigDecimal cumulativeCost,
            BigDecimal cumulativePayout,
            BigDecimal cumulativeProfit,
            Double roi,
            List<GamePlayDetail> gamesDetails) {
    }

    /** One game's play on a draw date. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GamePlayDetail(
            String gameName,
            BigDecimal betLevel,
            List<Integer> winningNumbers,
            Map<String, List<Integer>> selectedPools,
            Integer totalCombinations,
            BigDecimal playCost,
            BigDecimal winnings,
            BigDecimal profit,
            String result,
            MatchDetails matchDetails) {
    }

    /** How close one game's play came. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MatchDetails(
            Integer fullTraps,
            Integer minus1Traps,
            Integer minus2Traps,
            String bestMatch) {
    }

    /** One month of a year of the combined replays; a break-even month is {@code NEUTRAL}. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MonthlySummary(
            Integer month,
            String monthName,
            Integer totalPlays,
            Integer totalWins,
            Double winRate,
            BigDecimal monthlyCost,
            BigDecimal monthlyPayout,
            BigDecimal monthlyProfit,
            BigDecimal cumulativeCost,
            BigDecimal cumulativePayout,
            BigDecimal cumulativeProfit,
            Double roi,
            BigDecimal startingBalance,
            BigDecimal accountBalance,
            String status) {
    }

    /** What the play leaves of the balance. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CapitalManagement(
            BigDecimal remainingBalance,
            Double percentageUsed,
            List<ExcludedGame> gamesExcludedByBudget) {
    }

    /** A qualified game that did not fit the budget. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ExcludedGame(
            String gameId,
            BigDecimal estimatedCost,
            Integer gameOutValue,
            Double roi,
            String reason) {
    }

    /** When the recommendation was made and which games it left out. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Metadata(
            Instant requestTimestamp,
            LocalDate analysisDate,
            List<String> gamesExcludedByType,
            List<String> gamesSkippedByThreshold) {
    }
}
