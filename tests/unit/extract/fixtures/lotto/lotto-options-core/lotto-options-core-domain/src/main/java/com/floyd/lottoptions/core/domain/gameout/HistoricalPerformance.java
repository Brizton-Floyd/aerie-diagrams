package com.floyd.lottoptions.core.domain.gameout;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * How a game's recommendation would have done had it been played on every draw of the
 * requested years, the bet level following the balance. The replay walks the history newest
 * first, so its breakdowns and plays are in that order.
 *
 * @param year             the one year replayed, or {@code null} when several were
 * @param years            the years replayed, or {@code null} when only one was
 * @param combinedStats    whether several years were replayed
 * @param totalDraws       the draws in the years replayed
 * @param playsTaken       the draws the game-out rule played
 * @param playsSkipped     the draws it skipped
 * @param playsWon         the plays that won
 * @param playsLost        the plays that lost
 * @param winRate          {@code playsWon} as a percentage of {@code playsTaken}
 * @param totalCost        what the plays cost
 * @param totalWinnings    what the plays won
 * @param netProfit        {@code totalWinnings} less {@code totalCost}
 * @param roi              {@code netProfit} as a percentage of {@code totalCost}
 * @param startingBalance  the balance the replay started with
 * @param currentBalance   the balance after the last play
 * @param peakBalance      the highest balance after a play
 * @param lowestBalance    the lowest balance after a play
 * @param maxWinStreak     the longest run of wins
 * @param maxLossStreak    the longest run of losses
 * @param currentStreak    the run at the end, as {@code 3 wins}, {@code 2 losses} or {@code NONE}
 * @param greenMonths      the months that made money
 * @param redMonths        the months that lost money
 * @param monthlyBreakdown each month with a play, in replay order
 * @param yearlyBreakdown  each year with a play, in replay order
 * @param dailyPlays       every play, in replay order
 */
public record HistoricalPerformance(
        Integer year,
        List<Integer> years,
        boolean combinedStats,
        int totalDraws,
        int playsTaken,
        int playsSkipped,
        int playsWon,
        int playsLost,
        double winRate,
        BigDecimal totalCost,
        BigDecimal totalWinnings,
        BigDecimal netProfit,
        double roi,
        BigDecimal startingBalance,
        BigDecimal currentBalance,
        BigDecimal peakBalance,
        BigDecimal lowestBalance,
        int maxWinStreak,
        int maxLossStreak,
        String currentStreak,
        int greenMonths,
        int redMonths,
        List<MonthlyStats> monthlyBreakdown,
        List<YearlyStats> yearlyBreakdown,
        List<DailyPlay> dailyPlays) {

    public HistoricalPerformance {
        years = years == null ? null : Collections.unmodifiableList(new ArrayList<>(years));
        monthlyBreakdown = List.copyOf(monthlyBreakdown);
        yearlyBreakdown = List.copyOf(yearlyBreakdown);
        dailyPlays = List.copyOf(dailyPlays);
    }

    /**
     * One month of the replay.
     *
     * @param month    the month, as {@code yyyy-MM}
     * @param plays    the plays in the month
     * @param wins     the plays that won
     * @param cost     what the plays cost
     * @param winnings what the plays won
     * @param profit   {@code winnings} less {@code cost}
     * @param status   whether the month made money
     * @param traps    a large-pool game's trap counts, or {@code null} for a digit game
     */
    public record MonthlyStats(
            String month,
            int plays,
            int wins,
            BigDecimal cost,
            BigDecimal winnings,
            BigDecimal profit,
            ProfitStatus status,
            MonthlyTraps traps) {
    }

    /**
     * How often a large-pool game's whole-number pool trapped a month's draws.
     *
     * @param fullTraps      the plays whose draw the pool fully trapped
     * @param minus1Traps    the plays one number short of a full trap
     * @param minus2Traps    the plays two numbers short of a full trap
     * @param fullTrapRate   {@code fullTraps} as a percentage of the month's plays
     * @param minus1TrapRate {@code minus1Traps} as a percentage of the month's plays
     * @param minus2TrapRate {@code minus2Traps} as a percentage of the month's plays
     */
    public record MonthlyTraps(
            int fullTraps,
            int minus1Traps,
            int minus2Traps,
            double fullTrapRate,
            double minus1TrapRate,
            double minus2TrapRate) {
    }

    /**
     * One year of the replay.
     *
     * @param year     the year
     * @param plays    the plays in the year
     * @param wins     the plays that won
     * @param cost     what the plays cost
     * @param winnings what the plays won
     * @param profit   {@code winnings} less {@code cost}
     * @param winRate  {@code wins} as a percentage of {@code plays}
     * @param status   whether the year made money
     */
    public record YearlyStats(
            int year,
            int plays,
            int wins,
            BigDecimal cost,
            BigDecimal winnings,
            BigDecimal profit,
            double winRate,
            ProfitStatus status) {
    }

    /**
     * One play of the replay.
     *
     * @param drawDate              the draw played
     * @param trainingDataStartDate the oldest draw the pools were trained on, or {@code null}
     *                              without training draws
     * @param trainingDataEndDate   the latest draw the pools were trained on, or {@code null}
     *                              without training draws
     * @param trainingDataSize      the draws the pools were trained on
     * @param betLevel              the stake per combination, from the balance before the play
     * @param winningNumbers        the numbers drawn
     * @param selectedPools         each position's pool, in pool order
     * @param totalCombinations     the combinations played
     * @param playCost              what the play cost
     * @param winnings              what the play won
     * @param profit                {@code winnings} less {@code playCost}
     * @param result                whether the play won
     * @param fullTraps             1 when a large-pool pool fully trapped the draw, else 0
     * @param minus1Traps           1 when it was one number short of a full trap, else 0
     * @param minus2Traps           1 when it was two numbers short of a full trap, else 0
     * @param bestMatch             how close the play came
     * @param cumulativeCost        what the plays so far cost
     * @param cumulativePayout      what the plays so far won
     * @param cumulativeProfit      {@code cumulativePayout} less {@code cumulativeCost}
     * @param accountBalance        the balance after the play
     * @param roi                   {@code cumulativeProfit} as a percentage of {@code cumulativeCost}
     */
    public record DailyPlay(
            LocalDate drawDate,
            LocalDate trainingDataStartDate,
            LocalDate trainingDataEndDate,
            int trainingDataSize,
            BigDecimal betLevel,
            List<Integer> winningNumbers,
            Map<String, List<Integer>> selectedPools,
            int totalCombinations,
            BigDecimal playCost,
            BigDecimal winnings,
            BigDecimal profit,
            PlayResult result,
            int fullTraps,
            int minus1Traps,
            int minus2Traps,
            BestMatch bestMatch,
            BigDecimal cumulativeCost,
            BigDecimal cumulativePayout,
            BigDecimal cumulativeProfit,
            BigDecimal accountBalance,
            double roi) {

        public DailyPlay {
            winningNumbers = List.copyOf(winningNumbers);
            selectedPools = Collections.unmodifiableMap(new LinkedHashMap<>(selectedPools));
        }
    }
}
