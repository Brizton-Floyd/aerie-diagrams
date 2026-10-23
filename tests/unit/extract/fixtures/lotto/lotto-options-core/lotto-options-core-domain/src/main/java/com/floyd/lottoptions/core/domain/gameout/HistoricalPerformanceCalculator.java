package com.floyd.lottoptions.core.domain.gameout;

import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRecommendation.AggregatedStats;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRecommendation.CombinedHistoricalPerformance;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRecommendation.ConsolidatedDailyResult;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRecommendation.GamePlayDetail;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRecommendation.MonthlySummary;
import com.floyd.lottoptions.core.domain.gameout.MultiStateRecommendation.YearlyPerformance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Pure, stateless calculator of backtested historical performance (FR-026).
 *
 * <p>Replays a game's draw history to produce single-game performance
 * (plays/wins, cost/winnings, streaks, monthly/yearly breakdowns), and
 * aggregates and combines per-game results across a multi-state recommendation
 * (aggregated stats, combined performance, yearly breakdown, and the neutral-ROI
 * fallback used for ranking).</p>
 *
 * <p>It composes the other stateless collaborators (pattern engine, combination
 * generator, wagering-strategy calculator) and the clock that supplies "today"
 * by plain constructor injection (ADR-0008).</p>
 */
public final class HistoricalPerformanceCalculator {

    /**
     * Neutral ROI assigned to a game with no historical performance, so multi-state
     * ranking falls back to game-out order (ROI ties cancel) instead of excluding it.
     */
    private static final double NEUTRAL_ROI_PRIOR = 50.0;

    private static final String[] MONTH_NAMES = {"", "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"};

    private final PositionalPatternEngine positionalPatternEngine;
    private final CombinationGenerator combinationGenerator;
    private final WageringStrategyCalculator wageringStrategyCalculator;
    private final Clock clock;

    public HistoricalPerformanceCalculator(PositionalPatternEngine positionalPatternEngine,
                                           CombinationGenerator combinationGenerator,
                                           WageringStrategyCalculator wageringStrategyCalculator,
                                           Clock clock) {
        this.positionalPatternEngine = positionalPatternEngine;
        this.combinationGenerator = combinationGenerator;
        this.wageringStrategyCalculator = wageringStrategyCalculator;
        this.clock = clock;
    }

    public double calculateROI(GameOutRecommendation recommendation) {
        if (recommendation.historicalPerformance() != null) {
            return recommendation.historicalPerformance().roi();
        }
        return NEUTRAL_ROI_PRIOR;
    }

    public AggregatedStats calculateAggregatedStats(List<GameOutRecommendation> games, MultiStateRequest request) {

        long totalCombinations = games.stream()
            .mapToLong(g -> g.combinationPlay().map(play -> (long) play.combinations().size()).orElse(0L))
            .sum();

        BigDecimal totalCost = games.stream()
            .map(g -> g.combinationPlay().map(GameOutRecommendation.CombinationPlay::totalCost).orElse(BigDecimal.ZERO))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpectedPrizes = games.stream()
            .map(g -> g.combinationPlay().map(GameOutRecommendation.CombinationPlay::prize).orElse(BigDecimal.ZERO))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        double averageGameOutValue = games.stream()
            .mapToInt(GameOutRecommendation::gameOutValue)
            .average()
            .orElse(0.0);

        CombinedHistoricalPerformance combinedPerformance = calculateCombinedHistoricalPerformance(games, request);

        return new AggregatedStats(totalCombinations, totalCost, totalExpectedPrizes, averageGameOutValue,
            combinedPerformance);
    }

    private CombinedHistoricalPerformance calculateCombinedHistoricalPerformance(
            List<GameOutRecommendation> games, MultiStateRequest request) {

        int totalPlays = 0;
        int totalWins = 0;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalPayout = BigDecimal.ZERO;
        int greenMonths = 0;
        int redMonths = 0;

        Map<Integer, Map<Integer, YearMonthData>> yearlyData = new TreeMap<>();

        for (GameOutRecommendation game : games) {
            HistoricalPerformance perf = game.historicalPerformance();
            if (perf != null) {
                totalPlays += perf.playsTaken();
                totalWins += perf.playsWon();
                totalCost = totalCost.add(perf.totalCost());
                totalPayout = totalPayout.add(perf.totalWinnings());
                greenMonths += perf.greenMonths();
                redMonths += perf.redMonths();

                // Extract daily play history from each game
                if (!perf.dailyPlays().isEmpty()) {
                    for (HistoricalPerformance.DailyPlay dailyPlay : perf.dailyPlays()) {
                        LocalDate drawDate = dailyPlay.drawDate();
                        YearMonthData data = yearlyData
                            .computeIfAbsent(drawDate.getYear(), year -> new TreeMap<>())
                            .computeIfAbsent(drawDate.getMonthValue(), month -> new YearMonthData());

                        // Aggregate monthly totals
                        data.plays += 1;
                        if (dailyPlay.result() == PlayResult.WIN) {
                            data.wins += 1;
                        }
                        data.cost = data.cost.add(dailyPlay.playCost());
                        data.payout = data.payout.add(dailyPlay.winnings());

                        // Add this game's play to the date's consolidated result; the first game
                        // for the date supplies its training data range
                        data.dailyResultsByDate.computeIfAbsent(drawDate, date -> new DayData(dailyPlay))
                            .add(game.gameId(), dailyPlay);
                    }
                } else {
                    // Fallback to monthly breakdown if daily play history not available
                    for (HistoricalPerformance.MonthlyStats monthStats : perf.monthlyBreakdown()) {
                        String[] parts = monthStats.month().split("-");
                        YearMonthData data = yearlyData
                            .computeIfAbsent(Integer.parseInt(parts[0]), year -> new TreeMap<>())
                            .computeIfAbsent(Integer.parseInt(parts[1]), month -> new YearMonthData());

                        data.plays += monthStats.plays();
                        data.wins += monthStats.wins();
                        data.cost = data.cost.add(monthStats.cost());
                        data.payout = data.payout.add(monthStats.winnings());
                    }
                }
            }
        }

        List<YearlyPerformance> yearlyBreakdown = calculateYearlyBreakdown(yearlyData, request);

        double overallWinRate = totalPlays > 0 ? (double) totalWins / totalPlays * 100 : 0.0;
        BigDecimal netProfit = totalPayout.subtract(totalCost);
        double roi = percentageOf(netProfit, totalCost);

        return new CombinedHistoricalPerformance(totalPlays, totalWins, overallWinRate, totalCost, totalPayout,
            netProfit, roi, greenMonths, redMonths, yearlyBreakdown);
    }

    private List<YearlyPerformance> calculateYearlyBreakdown(
            Map<Integer, Map<Integer, YearMonthData>> yearlyData, MultiStateRequest request) {

        List<YearlyPerformance> breakdown = new ArrayList<>();

        for (Map.Entry<Integer, Map<Integer, YearMonthData>> yearEntry : yearlyData.entrySet()) {
            int year = yearEntry.getKey();
            Map<Integer, YearMonthData> monthlyData = yearEntry.getValue();

            int yearPlays = 0;
            int yearWins = 0;
            BigDecimal yearCost = BigDecimal.ZERO;
            BigDecimal yearPayout = BigDecimal.ZERO;
            int yearGreenMonths = 0;
            int yearRedMonths = 0;

            List<DayData> days = new ArrayList<>();
            List<MonthlySummary> monthlySummary = new ArrayList<>();
            BigDecimal cumulativeCost = BigDecimal.ZERO;
            BigDecimal cumulativePayout = BigDecimal.ZERO;

            // Track account balance for monthly summary
            BigDecimal monthlyAccountBalance = request.startingBalance() != null ?
                request.startingBalance() : new BigDecimal("1000.00");

            for (Map.Entry<Integer, YearMonthData> monthEntry : monthlyData.entrySet()) {
                int month = monthEntry.getKey();
                YearMonthData data = monthEntry.getValue();

                yearPlays += data.plays;
                yearWins += data.wins;
                BigDecimal monthlyCost = data.cost;
                BigDecimal monthlyPayout = data.payout;
                yearCost = yearCost.add(monthlyCost);
                yearPayout = yearPayout.add(monthlyPayout);

                BigDecimal monthProfit = monthlyPayout.subtract(monthlyCost);
                ProfitStatus monthStatus = ProfitStatus.of(monthProfit);
                if (monthStatus == ProfitStatus.GREEN) {
                    yearGreenMonths++;
                } else if (monthStatus == ProfitStatus.RED) {
                    yearRedMonths++;
                }

                // Capture starting balance for this month before updating
                BigDecimal monthStartingBalance = monthlyAccountBalance;

                // Update account balance with monthly profit
                monthlyAccountBalance = monthlyAccountBalance.add(monthProfit);

                cumulativeCost = cumulativeCost.add(monthlyCost);
                cumulativePayout = cumulativePayout.add(monthlyPayout);
                BigDecimal cumulativeProfit = cumulativePayout.subtract(cumulativeCost);

                double monthRoi = percentageOf(cumulativeProfit, cumulativeCost);

                double winRate = data.plays > 0 ? (double) data.wins / data.plays * 100 : 0.0;

                monthlySummary.add(new MonthlySummary(month, MONTH_NAMES[month], data.plays, data.wins, winRate,
                    monthlyCost, monthlyPayout, monthProfit, cumulativeCost, cumulativePayout, cumulativeProfit,
                    monthRoi, monthStartingBalance, monthlyAccountBalance, monthStatus));

                days.addAll(data.dailyResultsByDate.values());
            }

            double yearWinRate = yearPlays > 0 ? (double) yearWins / yearPlays * 100 : 0.0;
            BigDecimal yearNetProfit = yearPayout.subtract(yearCost);
            double yearRoi = percentageOf(yearNetProfit, yearCost);

            // Sort daily results by date and recalculate cumulative values across all games
            days.sort(Comparator.comparing(day -> day.drawDate));

            List<ConsolidatedDailyResult> dailyPlayHistory = new ArrayList<>();
            BigDecimal runningCost = BigDecimal.ZERO;
            BigDecimal runningPayout = BigDecimal.ZERO;
            BigDecimal accountBalance = request.startingBalance() != null ?
                request.startingBalance() : request.accountBalance();

            for (DayData day : days) {
                runningCost = runningCost.add(day.totalCost);
                runningPayout = runningPayout.add(day.totalWinnings);
                BigDecimal runningProfit = runningPayout.subtract(runningCost);
                accountBalance = accountBalance.add(day.totalProfit);

                // Use the first game's bet level (represents the bet level at start of day)
                // This ensures we only use valid bet levels: $0.25, $0.50, $1.00, $2.00
                BigDecimal dayBetLevel = day.gamesDetails.get(0).play().betLevel();

                double roi = percentageOf(runningProfit, runningCost);

                dailyPlayHistory.add(new ConsolidatedDailyResult(day.drawDate, day.trainingDataStartDate,
                    day.trainingDataEndDate, day.trainingDataSize, day.gamesPlayed, day.gamesWon, day.totalCost,
                    day.totalWinnings, day.totalProfit, accountBalance, dayBetLevel, request.riskLevel(),
                    runningCost, runningPayout, runningProfit, roi, day.gamesDetails));
            }

            breakdown.add(new YearlyPerformance(year, yearPlays, yearWins, yearWinRate, yearCost, yearPayout,
                yearNetProfit, yearRoi, yearGreenMonths, yearRedMonths, dailyPlayHistory, monthlySummary));
        }

        return breakdown;
    }

    /** One month of the combined replays, as it accumulates. */
    private static final class YearMonthData {
        int plays = 0;
        int wins = 0;
        BigDecimal cost = BigDecimal.ZERO;
        BigDecimal payout = BigDecimal.ZERO;
        final Map<LocalDate, DayData> dailyResultsByDate = new LinkedHashMap<>();
    }

    /** Every game's play on one draw date of the combined replays, as it accumulates. */
    private static final class DayData {
        final LocalDate drawDate;
        final LocalDate trainingDataStartDate;
        final LocalDate trainingDataEndDate;
        final int trainingDataSize;
        int gamesPlayed = 0;
        int gamesWon = 0;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalWinnings = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;
        final List<GamePlayDetail> gamesDetails = new ArrayList<>();

        DayData(HistoricalPerformance.DailyPlay firstPlay) {
            this.drawDate = firstPlay.drawDate();
            this.trainingDataStartDate = firstPlay.trainingDataStartDate();
            this.trainingDataEndDate = firstPlay.trainingDataEndDate();
            this.trainingDataSize = firstPlay.trainingDataSize();
        }

        void add(String gameName, HistoricalPerformance.DailyPlay play) {
            gamesDetails.add(new GamePlayDetail(gameName, play));
            gamesPlayed++;
            if (play.result() == PlayResult.WIN) {
                gamesWon++;
            }
            totalCost = totalCost.add(play.playCost());
            totalWinnings = totalWinnings.add(play.winnings());
            totalProfit = totalProfit.add(play.profit());
        }
    }

    /**
     * Replays a game's history over the requested years.
     *
     * @param request         the recommendation request: its years, starting balance and pool sizes
     * @param newestFirst     the game's draws, newest first
     * @param historicalDraws the numbers of the draws that have any, newest first; the i-th draw's
     *                        date is paired with the i-th entry, so every draw must have numbers
     * @param gameSize        the numbers per draw
     * @param maxGameOut      the largest game-out value that plays
     * @param gameType        how the game's patterns are read
     * @return the replay, or {@code null} when no draw falls in the requested years
     */
    public HistoricalPerformance calculateHistoricalPerformance(
            GameOutRequest request,
            List<Draw> newestFirst,
            List<List<Integer>> historicalDraws,
            int gameSize,
            int maxGameOut,
            GameType gameType) {

        // Determine which years to analyze (support both single and multiple years)
        List<Integer> yearsToAnalyze = new ArrayList<>();
        if (request.performanceYears() != null && !request.performanceYears().isEmpty()) {
            yearsToAnalyze.addAll(request.performanceYears());
        } else if (request.performanceYear() != null) {
            yearsToAnalyze.add(request.performanceYear());
        } else {
            yearsToAnalyze.add(LocalDate.now(clock).getYear());
        }

        BigDecimal startingBalance = request.startingBalance() != null ?
            request.startingBalance() : new BigDecimal("20000.00");

        // Use fixed training size of 200 draws (matches original CSV backtest)
        int trainingSize = 200;

        // Build all draw data
        List<Draw> allDrawData = new ArrayList<>();
        for (int i = 0; i < newestFirst.size(); i++) {
            allDrawData.add(new Draw(newestFirst.get(i).date(), historicalDraws.get(i)));
        }

        // Filter draws for the requested year(s)
        List<Draw> yearDraws = allDrawData.stream()
            .filter(d -> yearsToAnalyze.contains(d.date().getYear()))
            .collect(Collectors.toList());

        if (yearDraws.isEmpty()) {
            return null;
        }

        boolean isCombinedStats = yearsToAnalyze.size() > 1;

        // Find the earliest date in yearDraws to establish training data cutoff
        LocalDate earliestYearDate = yearDraws.stream()
            .map(Draw::date)
            .min(LocalDate::compareTo)
            .orElse(LocalDate.now(clock));

        // CRITICAL: Use fixed training data cutoff to match backtest
        // For real money operations, we must use the SAME training data as backtest
        // Backtest uses data ending 2024-07-18, so we enforce that here
        LocalDate trainingDataCutoff = LocalDate.of(2024, 7, 18);

        // Build training data from draws BEFORE the cutoff date
        // This ensures consistency with backtest results for real money operations
        List<Draw> trainingData = allDrawData.stream()
            .filter(d -> d.date().isBefore(earliestYearDate) && d.date().isBefore(trainingDataCutoff.plusDays(1)))
            .sorted((a, b) -> b.date().compareTo(a.date()))  // Sort newest first
            .limit(trainingSize)
            .sorted((a, b) -> a.date().compareTo(b.date()))  // Reverse to chronological (oldest first)
            .collect(Collectors.toList());

        // If insufficient historical data before the year, fall back to first 200 draws
        if (trainingData.size() < 50) {
            trainingData = allDrawData.subList(0, Math.min(trainingSize, allDrawData.size()));
        }

        Map<Integer, Set<Integer>> basePoolsForPatterns = positionalPatternEngine.buildBasePoolsForPatterns(trainingData, gameSize, 7);

        // Pre-calculate patterns for ALL draws (matches original CSV backtest)
        List<String> allPatterns = new ArrayList<>();
        for (Draw draw : allDrawData) {
            allPatterns.add(positionalPatternEngine.calculatePatternFromPools(draw.numbers(), basePoolsForPatterns, gameSize));
        }

        // Find where year draws start in the full historical list. Draw compares by value, but a
        // draw equal to the first year draw shares its date, so none comes before it.
        int yearStartIndex = allDrawData.indexOf(yearDraws.get(0));

        int totalDraws = yearDraws.size();
        int playsTaken = 0;
        int playsWon = 0;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalWinnings = BigDecimal.ZERO;
        BigDecimal currentBalance = startingBalance;
        BigDecimal peakBalance = startingBalance;
        BigDecimal lowestBalance = startingBalance;

        int currentWinStreak = 0;
        int currentLossStreak = 0;
        int maxWinStreak = 0;
        int maxLossStreak = 0;
        String currentStreakType = "NONE";

        Map<String, MonthData> monthlyMap = new LinkedHashMap<>();
        Map<String, Integer> lastSeen = new HashMap<>();
        List<HistoricalPerformance.DailyPlay> dailyPlays = new ArrayList<>();

        // Process each draw in the year (matches original CSV backtest logic)
        for (int i = 0; i < yearDraws.size(); i++) {
            int globalIndex = yearStartIndex + i;
            Draw draw = yearDraws.get(i);
            String monthKey = draw.date().getYear() + "-" + String.format("%02d", draw.date().getMonthValue());

            // Use pre-calculated pattern
            String pattern = allPatterns.get(globalIndex);

            // Calculate game out using simple index math (matches original CSV backtest)
            int gameOut = lastSeen.containsKey(pattern) ?
                globalIndex - lastSeen.get(pattern) : globalIndex;

            if (gameOut <= maxGameOut) {
                // Use fixed training data (matches backtest approach that showed good performance)
                // This ensures consistent pattern recognition across all predictions
                Map<String, Set<Integer>> adaptivePools;
                Set<Integer> poolNumbersForTraps = null;

                if (gameType == GameType.LARGE_POOL) {
                    // For large-pool games, build whole number pools
                    int poolSize = request.poolSize() != null ? request.poolSize() :
                        (gameSize == 6 ? 20 : 15);
                    int maxNumberRange = positionalPatternEngine.detectMaxNumberRange(request.gameId());

                    // Convert Draw to List<List<Integer>> for pool building
                    List<List<Integer>> trainingDraws = trainingData.stream()
                        .map(Draw::numbers)
                        .collect(Collectors.toList());

                    adaptivePools = combinationGenerator.buildAdaptiveWholeNumberPools(
                        pattern, trainingDraws, gameSize,
                        request.hPoolSize(), request.mPoolSize(),
                        poolSize, maxNumberRange);

                    // Extract pool numbers for trap calculation
                    poolNumbersForTraps = new HashSet<>();
                    for (Set<Integer> posPool : adaptivePools.values()) {
                        poolNumbersForTraps.addAll(posPool);
                    }
                } else {
                    // For digit-based games, use original method
                    adaptivePools = combinationGenerator.buildAdaptivePoolsFromHistory(
                        pattern, trainingData, gameSize,
                        request.hPoolSize(), request.mPoolSize());
                }

                List<List<Integer>> combinations = combinationGenerator.generateCombinations(adaptivePools, gameSize);

                // Calculate dynamic bet level based on current account balance
                // This allows bet level to scale as the account grows
                BigDecimal actualBetLevel = wageringStrategyCalculator.calculateRecommendedBetLevel(currentBalance);

                BigDecimal playCost = actualBetLevel.multiply(new BigDecimal(combinations.size()));

                boolean won = combinationGenerator.isFullHit(draw.numbers(), adaptivePools);
                BigDecimal prize = won ? combinationGenerator.calculatePrize(actualBetLevel, gameSize) : BigDecimal.ZERO;

                playsTaken++;
                totalCost = totalCost.add(playCost);
                currentBalance = currentBalance.subtract(playCost);

                BigDecimal profit = prize.subtract(playCost);

                if (won) {
                    playsWon++;
                    totalWinnings = totalWinnings.add(prize);
                    currentBalance = currentBalance.add(prize);

                    currentWinStreak++;
                    currentLossStreak = 0;
                    maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
                    currentStreakType = currentWinStreak + " wins";
                } else {
                    currentLossStreak++;
                    currentWinStreak = 0;
                    maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
                    currentStreakType = currentLossStreak + " losses";
                }

                // Calculate match details for this play
                int fullTraps = 0;
                int minus1Traps = 0;
                int minus2Traps = 0;
                BestMatch bestMatch = BestMatch.NO_MATCH;

                if (gameType == GameType.LARGE_POOL && poolNumbersForTraps != null) {
                    int matchCount = countTrapped(draw, poolNumbersForTraps, gameSize);

                    if (matchCount == gameSize) {
                        fullTraps = 1;
                        bestMatch = BestMatch.FULL_TRAP;
                    } else if (matchCount == gameSize - 1) {
                        minus1Traps = 1;
                        bestMatch = BestMatch.MINUS_1;
                    } else if (matchCount == gameSize - 2) {
                        minus2Traps = 1;
                        bestMatch = BestMatch.MINUS_2;
                    }
                } else if (won) {
                    bestMatch = BestMatch.FULL_HIT;
                }

                // Capture training data range for verification (using fixed training data)
                // Note: trainingData is now in chronological order (oldest first) after sorting
                LocalDate trainingStart = trainingData.isEmpty() ? null :
                    trainingData.get(0).date();  // Oldest = first in list
                LocalDate trainingEnd = trainingData.isEmpty() ? null :
                    trainingData.get(trainingData.size() - 1).date();  // Newest = last in list

                BigDecimal cumulativeProfit = totalWinnings.subtract(totalCost);

                // Store daily play data with positional pools, account balance, bet level, and training data range
                dailyPlays.add(new HistoricalPerformance.DailyPlay(
                    draw.date(),
                    trainingStart,
                    trainingEnd,
                    trainingData.size(),
                    actualBetLevel,
                    draw.numbers(),
                    poolsAsLists(adaptivePools),
                    combinations.size(),
                    playCost,
                    prize,
                    profit,
                    won ? PlayResult.WIN : PlayResult.LOSS,
                    fullTraps,
                    minus1Traps,
                    minus2Traps,
                    bestMatch,
                    totalCost,
                    totalWinnings,
                    cumulativeProfit,
                    currentBalance,
                    percentageOf(cumulativeProfit, totalCost)));

                // Update monthly stats
                MonthData monthStats = monthlyMap.computeIfAbsent(monthKey, MonthData::new);
                monthStats.plays++;
                monthStats.cost = monthStats.cost.add(playCost);
                if (won) {
                    monthStats.wins++;
                    monthStats.winnings = monthStats.winnings.add(prize);
                }

                // Track trap rates for large-pool games
                if (gameType == GameType.LARGE_POOL && poolNumbersForTraps != null) {
                    // Count matches with actual draw using the whole number pool
                    int matchCount = countTrapped(draw, poolNumbersForTraps, gameSize);

                    // Update trap counters
                    if (matchCount == gameSize) {
                        monthStats.fullTraps++;
                    } else if (matchCount == gameSize - 1) {
                        monthStats.minus1Traps++;
                    } else if (matchCount == gameSize - 2) {
                        monthStats.minus2Traps++;
                    }
                }

                peakBalance = peakBalance.max(currentBalance);
                lowestBalance = lowestBalance.min(currentBalance);
            }

            // Update lastSeen map (matches original CSV backtest)
            lastSeen.put(pattern, globalIndex);
        }

        int greenMonths = 0;
        int redMonths = 0;

        List<HistoricalPerformance.MonthlyStats> monthlyBreakdown = new ArrayList<>();
        // Calculate yearly breakdown
        Map<Integer, YearData> yearlyMap = new LinkedHashMap<>();

        for (MonthData monthStats : monthlyMap.values()) {
            BigDecimal profit = monthStats.winnings.subtract(monthStats.cost);
            ProfitStatus status = ProfitStatus.of(profit);
            if (status == ProfitStatus.GREEN) {
                greenMonths++;
            } else if (status == ProfitStatus.RED) {
                redMonths++;
            }

            // Only include trap fields (and their rates) for large-pool games
            HistoricalPerformance.MonthlyTraps traps = null;
            if (gameType == GameType.LARGE_POOL) {
                int plays = monthStats.plays;
                traps = new HistoricalPerformance.MonthlyTraps(monthStats.fullTraps, monthStats.minus1Traps,
                    monthStats.minus2Traps, monthStats.fullTraps * 100.0 / plays,
                    monthStats.minus1Traps * 100.0 / plays, monthStats.minus2Traps * 100.0 / plays);
            }

            monthlyBreakdown.add(new HistoricalPerformance.MonthlyStats(monthStats.month, monthStats.plays,
                monthStats.wins, monthStats.cost, monthStats.winnings, profit, status, traps));

            // Aggregate monthly stats into yearly stats
            int year = Integer.parseInt(monthStats.month.substring(0, 4));
            YearData yearStats = yearlyMap.computeIfAbsent(year, YearData::new);
            yearStats.plays += monthStats.plays;
            yearStats.wins += monthStats.wins;
            yearStats.cost = yearStats.cost.add(monthStats.cost);
            yearStats.winnings = yearStats.winnings.add(monthStats.winnings);
        }

        // Calculate yearly profit, win rate, and status
        List<HistoricalPerformance.YearlyStats> yearlyBreakdown = new ArrayList<>();
        for (YearData yearStats : yearlyMap.values()) {
            BigDecimal yearProfit = yearStats.winnings.subtract(yearStats.cost);
            double yearWinRate = yearStats.plays > 0 ?
                (yearStats.wins * 100.0 / yearStats.plays) : 0.0;
            yearlyBreakdown.add(new HistoricalPerformance.YearlyStats(yearStats.year, yearStats.plays,
                yearStats.wins, yearStats.cost, yearStats.winnings, yearProfit, yearWinRate,
                ProfitStatus.of(yearProfit)));
        }

        BigDecimal netProfit = totalWinnings.subtract(totalCost);
        double winRate = playsTaken > 0 ? (double) playsWon / playsTaken * 100 : 0.0;
        double roi = percentageOf(netProfit, totalCost);

        return new HistoricalPerformance(
            isCombinedStats ? null : yearsToAnalyze.get(0),
            isCombinedStats ? yearsToAnalyze : null,
            isCombinedStats,
            totalDraws,
            playsTaken,
            totalDraws - playsTaken,
            playsWon,
            playsTaken - playsWon,
            winRate,
            totalCost,
            totalWinnings,
            netProfit,
            roi,
            startingBalance,
            currentBalance,
            peakBalance,
            lowestBalance,
            maxWinStreak,
            maxLossStreak,
            currentStreakType,
            greenMonths,
            redMonths,
            monthlyBreakdown,
            yearlyBreakdown,
            dailyPlays);
    }

    /** The draw's numbers, up to the game size, that the whole-number pool holds. */
    private static int countTrapped(Draw draw, Set<Integer> poolNumbers, int gameSize) {
        int matchCount = 0;
        for (int j = 0; j < Math.min(gameSize, draw.numbers().size()); j++) {
            if (poolNumbers.contains(draw.numbers().get(j))) {
                matchCount++;
            }
        }
        return matchCount;
    }

    /** Each position's pool as a list, in pool order. */
    private static Map<String, List<Integer>> poolsAsLists(Map<String, Set<Integer>> pools) {
        Map<String, List<Integer>> selectedPools = new LinkedHashMap<>();
        for (Map.Entry<String, Set<Integer>> entry : pools.entrySet()) {
            selectedPools.put(entry.getKey(), new ArrayList<>(entry.getValue()));
        }
        return selectedPools;
    }

    /** {@code part} as a percentage of {@code whole}, to two decimals; 0 when {@code whole} is not positive. */
    private static double percentageOf(BigDecimal part, BigDecimal whole) {
        return whole.compareTo(BigDecimal.ZERO) > 0 ?
            part.divide(whole, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0.0;
    }

    /** One month of a single-game replay, as it accumulates. */
    private static final class MonthData {
        final String month;
        int plays = 0;
        int wins = 0;
        BigDecimal cost = BigDecimal.ZERO;
        BigDecimal winnings = BigDecimal.ZERO;
        int fullTraps = 0;
        int minus1Traps = 0;
        int minus2Traps = 0;

        MonthData(String month) {
            this.month = month;
        }
    }

    /** One year of a single-game replay, as it accumulates. */
    private static final class YearData {
        final int year;
        int plays = 0;
        int wins = 0;
        BigDecimal cost = BigDecimal.ZERO;
        BigDecimal winnings = BigDecimal.ZERO;

        YearData(int year) {
            this.year = year;
        }
    }
}
