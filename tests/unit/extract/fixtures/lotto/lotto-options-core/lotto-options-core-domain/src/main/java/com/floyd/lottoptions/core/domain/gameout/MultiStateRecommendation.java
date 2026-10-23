package com.floyd.lottoptions.core.domain.gameout;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * A recommendation over every game of one state: the PLAY games that fit the budget, highest
 * priority first, with the money management to play them by.
 *
 * @param state                      the state's name
 * @param betLevel                   the requested stake per combination
 * @param recommendedBetLevel        the stake the account balance supports
 * @param betLevelAdjustmentReason   how the requested stake compares with the recommended one
 * @param accountBalance             the money available
 * @param riskLevel                  the requested risk level
 * @param maxAllowedSpend            the most the play may spend: the balance times the risk factor
 * @param totalGamesAnalyzed         the games eligible for game-out
 * @param totalGamesQualified        the eligible games with a PLAY decision
 * @param totalGamesRecommended      the qualified games that fit the budget
 * @param totalGamesExcludedByBudget the qualified games that did not
 * @param recommendations            the recommended games, highest priority first
 * @param aggregatedStats            the recommended games' totals, or {@code null} without any
 * @param capitalManagement          what the play leaves of the balance
 * @param wageringStrategy           how to play the recommended games, or {@code null} without any
 * @param message                    why nothing is recommended, or {@code null} when something is
 * @param metadata                   when the recommendation was made and which games it left out
 */
public record MultiStateRecommendation(
        String state,
        BigDecimal betLevel,
        BigDecimal recommendedBetLevel,
        String betLevelAdjustmentReason,
        BigDecimal accountBalance,
        RiskLevel riskLevel,
        BigDecimal maxAllowedSpend,
        int totalGamesAnalyzed,
        int totalGamesQualified,
        int totalGamesRecommended,
        int totalGamesExcludedByBudget,
        List<GameOutRecommendation> recommendations,
        AggregatedStats aggregatedStats,
        CapitalManagement capitalManagement,
        WageringStrategy wageringStrategy,
        String message,
        Metadata metadata) {

    public MultiStateRecommendation {
        recommendations = List.copyOf(recommendations);
        Objects.requireNonNull(capitalManagement, "capitalManagement");
        Objects.requireNonNull(metadata, "metadata");
    }

    /**
     * What the play leaves of the balance.
     *
     * @param remainingBalance      the balance less the recommended games' cost
     * @param percentageUsed        the cost as a percentage of the balance
     * @param gamesExcludedByBudget the qualified games that did not fit the budget, in priority order
     */
    public record CapitalManagement(BigDecimal remainingBalance, double percentageUsed,
                                    List<ExcludedGame> gamesExcludedByBudget) {

        public CapitalManagement {
            gamesExcludedByBudget = List.copyOf(gamesExcludedByBudget);
        }
    }

    /**
     * A qualified game that did not fit the budget.
     *
     * @param gameId        the game's full name
     * @param estimatedCost what playing it costs
     * @param gameOutValue  its game-out value
     * @param roi           the ROI it was ranked by
     * @param reason        why it was left out
     */
    public record ExcludedGame(String gameId, BigDecimal estimatedCost, int gameOutValue, double roi,
                               String reason) {
    }

    /**
     * When the recommendation was made and which games it left out.
     *
     * @param requestTimestamp        when it was made
     * @param analysisDate            the day after it was made
     * @param gamesExcludedByType     the state's games not eligible for game-out, in the source's order
     * @param gamesSkippedByThreshold the eligible games with a SKIP decision or no recommendation
     */
    public record Metadata(Instant requestTimestamp, LocalDate analysisDate, List<String> gamesExcludedByType,
                           List<String> gamesSkippedByThreshold) {

        public Metadata {
            gamesExcludedByType = List.copyOf(gamesExcludedByType);
            gamesSkippedByThreshold = List.copyOf(gamesSkippedByThreshold);
        }
    }

    /**
     * The recommended games' totals.
     *
     * @param totalCombinations             the combinations to play
     * @param totalCost                     what they cost
     * @param totalExpectedPrizes           the prizes one win per game would pay
     * @param averageGameOutValue           the games' mean game-out value
     * @param combinedHistoricalPerformance the games' replays combined
     */
    public record AggregatedStats(long totalCombinations, BigDecimal totalCost, BigDecimal totalExpectedPrizes,
                                  double averageGameOutValue,
                                  CombinedHistoricalPerformance combinedHistoricalPerformance) {
    }

    /**
     * The recommended games' replays combined.
     *
     * @param totalPlays      the plays of every game
     * @param totalWins       the plays that won
     * @param overallWinRate  {@code totalWins} as a percentage of {@code totalPlays}
     * @param totalCost       what the plays cost
     * @param totalPayout     what the plays won
     * @param netProfit       {@code totalPayout} less {@code totalCost}
     * @param roi             {@code netProfit} as a percentage of {@code totalCost}
     * @param greenMonths     the games' months that made money, summed
     * @param redMonths       the games' months that lost money, summed
     * @param yearlyBreakdown each year with a play, oldest first
     */
    public record CombinedHistoricalPerformance(int totalPlays, int totalWins, double overallWinRate,
                                                BigDecimal totalCost, BigDecimal totalPayout, BigDecimal netProfit,
                                                double roi, int greenMonths, int redMonths,
                                                List<YearlyPerformance> yearlyBreakdown) {

        public CombinedHistoricalPerformance {
            yearlyBreakdown = List.copyOf(yearlyBreakdown);
        }
    }

    /**
     * One year of the combined replays.
     *
     * @param year             the year
     * @param totalPlays       the plays in the year
     * @param totalWins        the plays that won
     * @param winRate          {@code totalWins} as a percentage of {@code totalPlays}
     * @param totalCost        what the plays cost
     * @param totalPayout      what the plays won
     * @param netProfit        {@code totalPayout} less {@code totalCost}
     * @param roi              {@code netProfit} as a percentage of {@code totalCost}
     * @param greenMonths      the year's months that made money
     * @param redMonths        the year's months that lost money
     * @param dailyPlayHistory each draw date with a play, oldest first
     * @param monthlySummary   each month with a play, oldest first
     */
    public record YearlyPerformance(int year, int totalPlays, int totalWins, double winRate, BigDecimal totalCost,
                                    BigDecimal totalPayout, BigDecimal netProfit, double roi, int greenMonths,
                                    int redMonths, List<ConsolidatedDailyResult> dailyPlayHistory,
                                    List<MonthlySummary> monthlySummary) {

        public YearlyPerformance {
            dailyPlayHistory = List.copyOf(dailyPlayHistory);
            monthlySummary = List.copyOf(monthlySummary);
        }
    }

    /**
     * Every game's play on one draw date.
     *
     * @param drawDate              the draw date
     * @param trainingDataStartDate the first game's oldest training draw, or {@code null}
     * @param trainingDataEndDate   the first game's latest training draw, or {@code null}
     * @param trainingDataSize      the first game's training draws
     * @param gamesPlayed           the games played on the date
     * @param gamesWon              the games that won
     * @param totalCost             what the games cost
     * @param totalWinnings         what the games won
     * @param totalProfit           the games' profit
     * @param accountBalance        the year's running balance after the date
     * @param betLevel              the first game's stake
     * @param riskLevel             the requested risk level
     * @param cumulativeCost        what the year's plays so far cost
     * @param cumulativePayout      what the year's plays so far won
     * @param cumulativeProfit      {@code cumulativePayout} less {@code cumulativeCost}
     * @param roi                   {@code cumulativeProfit} as a percentage of {@code cumulativeCost}
     * @param gamesDetails          each game's play, in recommendation order
     */
    public record ConsolidatedDailyResult(LocalDate drawDate, LocalDate trainingDataStartDate,
                                          LocalDate trainingDataEndDate, int trainingDataSize, int gamesPlayed,
                                          int gamesWon, BigDecimal totalCost, BigDecimal totalWinnings,
                                          BigDecimal totalProfit, BigDecimal accountBalance, BigDecimal betLevel,
                                          RiskLevel riskLevel, BigDecimal cumulativeCost, BigDecimal cumulativePayout,
                                          BigDecimal cumulativeProfit, double roi,
                                          List<GamePlayDetail> gamesDetails) {

        public ConsolidatedDailyResult {
            gamesDetails = List.copyOf(gamesDetails);
        }
    }

    /**
     * One game's play on a draw date.
     *
     * @param gameName the game's full name
     * @param play     the play
     */
    public record GamePlayDetail(String gameName, HistoricalPerformance.DailyPlay play) {
    }

    /**
     * One month of a year of the combined replays.
     *
     * @param month            the month, 1 for January
     * @param monthName        the month's English name
     * @param totalPlays       the plays in the month
     * @param totalWins        the plays that won
     * @param winRate          {@code totalWins} as a percentage of {@code totalPlays}
     * @param monthlyCost      what the plays cost
     * @param monthlyPayout    what the plays won
     * @param monthlyProfit    {@code monthlyPayout} less {@code monthlyCost}
     * @param cumulativeCost   what the year's plays so far cost
     * @param cumulativePayout what the year's plays so far won
     * @param cumulativeProfit {@code cumulativePayout} less {@code cumulativeCost}
     * @param roi              {@code cumulativeProfit} as a percentage of {@code cumulativeCost}
     * @param startingBalance  the year's running balance before the month
     * @param accountBalance   the year's running balance after the month
     * @param status           whether the month made money
     */
    public record MonthlySummary(int month, String monthName, int totalPlays, int totalWins, double winRate,
                                 BigDecimal monthlyCost, BigDecimal monthlyPayout, BigDecimal monthlyProfit,
                                 BigDecimal cumulativeCost, BigDecimal cumulativePayout,
                                 BigDecimal cumulativeProfit, double roi, BigDecimal startingBalance,
                                 BigDecimal accountBalance, ProfitStatus status) {
    }
}
