package com.floyd.lottoptions.core.contract.gameout;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Response body of {@code POST /api/v1/gameout/recommendation}: PLAY or SKIP for a game's next
 * draw. A PLAY for a digit game carries its pools and combinations, a PLAY for a large-pool game
 * its whole-number pool, and a SKIP its reason; absent properties are left out.
 *
 * <p>Some nested types write their absent properties as {@code null} and some leave them out,
 * as each always has.</p>
 *
 * @param decision              {@code PLAY} or {@code SKIP}
 * @param gameId                the game's full name
 * @param drawDate              the day after the latest draw
 * @param betLevel              a PLAY's stake per combination
 * @param prize                 a digit-game PLAY's prize per winning combination
 * @param pattern               a PLAY's positional pattern
 * @param gameOutValue          the latest draw's game-out value
 * @param maxGameOut            the threshold it was held to
 * @param pools                 a digit-game PLAY's pool per position
 * @param combinations          a digit-game PLAY's combinations
 * @param totalCombinations     how many combinations it has
 * @param totalCost             what they cost
 * @param expectedPrize         the prize one winning combination pays
 * @param reason                a SKIP's reason
 * @param metadata              what the recommendation was trained on
 * @param historicalPerformance the replay of the requested years, when requested
 * @param poolNumbers           a large-pool PLAY's pool, ascending
 * @param poolSize              how many numbers it has
 * @param positionalBreakdown   each position's share of it, ascending
 * @param coverageAnalysis      how it covered the history, when historical performance was requested
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GameOutRecommendationResponse(
        String decision,
        String gameId,
        LocalDate drawDate,
        BigDecimal betLevel,
        BigDecimal prize,
        String pattern,
        Integer gameOutValue,
        Integer maxGameOut,
        Map<String, Set<Integer>> pools,
        List<List<Integer>> combinations,
        Long totalCombinations,
        BigDecimal totalCost,
        BigDecimal expectedPrize,
        String reason,
        Metadata metadata,
        HistoricalPerformance historicalPerformance,
        List<Integer> poolNumbers,
        Integer poolSize,
        Map<String, List<Integer>> positionalBreakdown,
        CoverageAnalysis coverageAnalysis) {

    /** What the recommendation was trained on. */
    public record Metadata(Integer trainingDraws, LocalDate lastDrawDate, Integer hPoolSize, Integer mPoolSize) {
    }

    /**
     * The replay of the requested years. {@code dailyPlayHistory} is {@code null} inside a
     * multi-state response, which carries the plays only in its consolidated stats.
     */
    public record HistoricalPerformance(
            Integer year,
            List<Integer> years,
            Boolean combinedStats,
            Integer totalDraws,
            Integer playsTaken,
            Integer playsSkipped,
            Integer playsWon,
            Integer playsLost,
            Double winRate,
            BigDecimal totalCost,
            BigDecimal totalWinnings,
            BigDecimal netProfit,
            Double roi,
            BigDecimal startingBalance,
            BigDecimal currentBalance,
            BigDecimal peakBalance,
            BigDecimal lowestBalance,
            Integer maxWinStreak,
            Integer maxLossStreak,
            String currentStreak,
            Integer greenMonths,
            Integer redMonths,
            List<MonthlyStats> monthlyBreakdown,
            List<YearlyStats> yearlyBreakdown,
            List<DailyPlayDetail> dailyPlayHistory) {
    }

    /** One play of the replay. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DailyPlayDetail(
            String drawDate,
            LocalDate trainingDataStartDate,
            LocalDate trainingDataEndDate,
            Integer trainingDataSize,
            BigDecimal betLevel,
            List<Integer> winningNumbers,
            Map<String, List<Integer>> selectedPools,
            Integer totalCombinations,
            BigDecimal playCost,
            BigDecimal winnings,
            BigDecimal profit,
            String result,
            Integer fullTraps,
            Integer minus1Traps,
            Integer minus2Traps,
            String bestMatch,
            BigDecimal cumulativeCost,
            BigDecimal cumulativePayout,
            BigDecimal cumulativeProfit,
            BigDecimal accountBalance,
            Double roi) {
    }

    /** One year of the replay. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record YearlyStats(
            Integer year,
            Integer plays,
            Integer wins,
            BigDecimal cost,
            BigDecimal winnings,
            BigDecimal profit,
            Double winRate,
            String status) {
    }

    /** One month of the replay; the trap properties only for a large-pool game. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MonthlyStats(
            String month,
            Integer plays,
            Integer wins,
            BigDecimal cost,
            BigDecimal winnings,
            BigDecimal profit,
            String status,
            Integer fullTraps,
            Integer minus1Traps,
            Integer minus2Traps,
            Double fullTrapRate,
            Double minus1TrapRate,
            Double minus2TrapRate) {
    }

    /** How a large-pool PLAY's pool covered the history. */
    public record CoverageAnalysis(
            Integer totalDrawsAnalyzed,
            Integer fullTraps,
            Integer minus1Traps,
            Integer minus2Traps,
            Double fullTrapRate,
            Double minus1TrapRate,
            Double minus2TrapRate) {
    }
}
