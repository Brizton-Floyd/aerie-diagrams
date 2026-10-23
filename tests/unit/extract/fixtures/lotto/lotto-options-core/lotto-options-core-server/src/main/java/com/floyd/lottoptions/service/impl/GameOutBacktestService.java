package com.floyd.lottoptions.service.impl;

import com.floyd.lottoptions.service.LotteryStateService;
import com.floyd.model.request.MonthlyBacktestRequest;
import com.floyd.model.request.MultiGameBacktestRequest;
import com.floyd.model.response.MonthlyBacktestResponse;
import com.floyd.model.response.MultiGameBacktestResponse;
import com.floyd.persistence.model.response.StateGamesResponse;
import com.floyd.persistence.model.LotteryDraw;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class GameOutBacktestService {
    
    private final LotteryStateService lotteryStateService;
    private final Clock clock;
    
    public GameOutBacktestService(LotteryStateService lotteryStateService, Clock clock) {
        this.lotteryStateService = lotteryStateService;
        this.clock = clock;
    }
    
    public Mono<MonthlyBacktestResponse> generateMonthlyBacktest(MonthlyBacktestRequest request) {
        return Mono.fromCallable(() -> {
            log.info("Generating monthly backtest: game={}, year={}, betLevel={}", 
                request.getGameId(), request.getYear(), request.getBetLevel());
            
            request.validate();
            
            StateGamesResponse gameData = lotteryStateService.getLottoGameDrawData(
                request.getGameId(), request.getState())
                .orElseThrow(() -> new IllegalArgumentException("No historical data available for " + request.getGameId()));
            
            if (gameData.getLotteryGame() == null || 
                gameData.getLotteryGame().getLotteryDraws() == null) {
                throw new IllegalArgumentException("No historical data available for " + request.getGameId());
            }
            
            List<LotteryDraw> draws = gameData.getLotteryGame().getLotteryDraws();
            Collections.reverse(draws);
            
            List<DrawData> historicalDraws = draws.stream()
                .map(draw -> new DrawData(
                    draw.getDrawResults() != null ? draw.getDrawResults() : Collections.emptyList(),
                    draw.getDrawDate(),
                    draw.getDrawDate().getYear()
                ))
                .filter(d -> !d.numbers.isEmpty())
                .collect(Collectors.toList());
            
            int gameSize = detectGameSize(historicalDraws, request.getGameId());
            BigDecimal prize = calculatePrize(request.getBetLevel(), gameSize);
            
            List<DrawData> yearDraws = historicalDraws.stream()
                .filter(d -> d.year == request.getYear())
                .collect(Collectors.toList());
            
            if (yearDraws.isEmpty()) {
                throw new IllegalArgumentException("No data available for year " + request.getYear());
            }
            
            // Use fixed training size of 200 draws (matches original CSV backtest)
            int trainingSize = 200;
            
            // Build base pools from first 200 draws of ALL historical data (not just pre-year)
            List<DrawData> trainingData = historicalDraws.subList(0, Math.min(trainingSize, historicalDraws.size()));
            Map<Integer, Set<Integer>> basePools = buildBasePoolsForPatterns(trainingData, gameSize, 7);
            
            // Pre-calculate patterns for ALL draws (matches original CSV backtest)
            List<String> allPatterns = new ArrayList<>();
            for (DrawData draw : historicalDraws) {
                allPatterns.add(calculatePatternFromPools(draw.numbers, basePools, gameSize));
            }
            
            // Find where year draws start in the full historical list
            int yearStartIndex = historicalDraws.indexOf(yearDraws.get(0));
            
            Map<String, MonthlyStats> monthlyStats = new LinkedHashMap<>();
            Map<String, Integer> lastSeen = new HashMap<>();
            
            // Process each year draw
            for (int i = 0; i < yearDraws.size(); i++) {
                int globalIndex = yearStartIndex + i;
                DrawData draw = yearDraws.get(i);
                String month = draw.date.toString().substring(0, 7);
                
                MonthlyStats stats = monthlyStats.computeIfAbsent(month, k -> new MonthlyStats(month));
                stats.totalDraws++;
                
                String pattern = allPatterns.get(globalIndex);
                
                // Calculate game out using simple index math (matches original CSV backtest)
                int gameOut = lastSeen.containsKey(pattern) ? 
                    globalIndex - lastSeen.get(pattern) : globalIndex;
                
                if (i < 5) {
                    log.debug("Draw {}: date={}, numbers={}, globalIndex={}, pattern={}, gameOut={}, lastSeen={}, maxGameOut={}", 
                        i, draw.date, draw.numbers, globalIndex, pattern, gameOut, 
                        lastSeen.containsKey(pattern) ? lastSeen.get(pattern) : "NEVER", request.getMaxGameOut());
                }
                
                if (gameOut <= request.getMaxGameOut()) {
                    // Build adaptive pools from fixed training data (first 200 draws)
                    Map<Integer, Set<Integer>> pools = buildAdaptivePools(
                        pattern, trainingData, gameSize,
                        request.getHPoolSize(), request.getMPoolSize());
                    
                    long combinations = calculateCombinations(pools);
                    
                    if (stats.plays < 3) {
                        log.info("BACKTEST Play #{}: pattern={}, gameOut={}, pools={}, combinations={}", 
                            stats.plays + 1, pattern, gameOut, pools, combinations);
                    }
                    BigDecimal cost = request.getBetLevel().multiply(new BigDecimal(combinations));
                    
                    boolean won = isFullHit(draw.numbers, pools);
                    BigDecimal payout = won ? prize : BigDecimal.ZERO;
                    
                    stats.plays++;
                    stats.totalCost = stats.totalCost.add(cost);
                    stats.totalPayout = stats.totalPayout.add(payout);
                    if (won) stats.wins++;
                }
                
                // Update lastSeen map (matches original CSV backtest)
                lastSeen.put(pattern, globalIndex);
            }
            
            List<MonthlyBacktestResponse.MonthlyStats> monthlyStatsList = new ArrayList<>();
            int totalDraws = 0, totalPlays = 0, totalWins = 0, greenMonths = 0, redMonths = 0;
            BigDecimal totalCost = BigDecimal.ZERO, totalPayout = BigDecimal.ZERO;
            
            for (MonthlyStats stats : monthlyStats.values()) {
                BigDecimal netProfit = stats.totalPayout.subtract(stats.totalCost);
                BigDecimal winRate = stats.plays > 0 ? 
                    new BigDecimal(stats.wins).multiply(new BigDecimal("100"))
                        .divide(new BigDecimal(stats.plays), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
                
                String status = netProfit.compareTo(BigDecimal.ZERO) >= 0 ? "GREEN" : "RED";
                if ("GREEN".equals(status)) greenMonths++; else redMonths++;
                
                monthlyStatsList.add(MonthlyBacktestResponse.MonthlyStats.builder()
                    .month(stats.month)
                    .totalDraws(stats.totalDraws)
                    .plays(stats.plays)
                    .wins(stats.wins)
                    .winRate(winRate)
                    .totalCost(stats.totalCost)
                    .totalPayout(stats.totalPayout)
                    .netProfit(netProfit)
                    .status(status)
                    .build());
                
                totalDraws += stats.totalDraws;
                totalPlays += stats.plays;
                totalWins += stats.wins;
                totalCost = totalCost.add(stats.totalCost);
                totalPayout = totalPayout.add(stats.totalPayout);
            }
            
            BigDecimal netProfit = totalPayout.subtract(totalCost);
            BigDecimal overallWinRate = totalPlays > 0 ?
                new BigDecimal(totalWins).multiply(new BigDecimal("100"))
                    .divide(new BigDecimal(totalPlays), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            BigDecimal roi = totalCost.compareTo(BigDecimal.ZERO) > 0 ?
                netProfit.multiply(new BigDecimal("100"))
                    .divide(totalCost, 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            BigDecimal successRate = !monthlyStats.isEmpty() ?
                new BigDecimal(greenMonths).multiply(new BigDecimal("100"))
                    .divide(new BigDecimal(monthlyStats.size()), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            
            MonthlyBacktestResponse.Summary summary = MonthlyBacktestResponse.Summary.builder()
                .totalDraws(totalDraws)
                .totalPlays(totalPlays)
                .totalWins(totalWins)
                .overallWinRate(overallWinRate)
                .totalCost(totalCost)
                .totalPayout(totalPayout)
                .netProfit(netProfit)
                .roi(roi)
                .greenMonths(greenMonths)
                .redMonths(redMonths)
                .successRate(successRate)
                .build();
            
            return MonthlyBacktestResponse.builder()
                .gameId(request.getGameId())
                .year(request.getYear())
                .betLevel(request.getBetLevel())
                .prize(prize)
                .monthlyStats(monthlyStatsList)
                .summary(summary)
                .build();
                
        }).subscribeOn(Schedulers.boundedElastic());
    }
    
    private int detectGameSize(List<DrawData> draws, String gameId) {
        if (!draws.isEmpty() && !draws.get(0).numbers.isEmpty()) {
            return draws.get(0).numbers.size();
        }
        return gameId.toLowerCase().contains("pick 3") ? 3 : 4;
    }
    
    private String calculatePatternFromPools(List<Integer> draw, Map<Integer, Set<Integer>> basePools, int gameSize) {
        StringBuilder pattern = new StringBuilder();
        for (int pos = 0; pos < gameSize; pos++) {
            boolean hit = basePools.get(pos).contains(draw.get(pos));
            pattern.append(hit ? 'H' : 'M');
        }
        return pattern.toString();
    }
    
    private Map<Integer, Set<Integer>> buildBasePoolsForPatterns(List<DrawData> history, int gameSize, int poolSize) {
        Map<Integer, Set<Integer>> pools = new LinkedHashMap<>();
        for (int pos = 0; pos < gameSize; pos++) {
            Map<Integer, Integer> digitFreq = new HashMap<>();
            for (DrawData draw : history) {
                if (pos < draw.numbers.size()) {
                    digitFreq.merge(draw.numbers.get(pos), 1, Integer::sum);
                }
            }
            
            Set<Integer> pool = digitFreq.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(poolSize)
                .map(Map.Entry::getKey)
                .collect(Collectors.toCollection(LinkedHashSet::new));
            
            pools.put(pos, pool);
        }
        return pools;
    }
    
    private Map<Integer, Set<Integer>> buildAdaptivePools(String pattern, List<DrawData> history,
                                                           int gameSize, int hPoolSize, int mPoolSize) {
        Map<Integer, Set<Integer>> pools = new LinkedHashMap<>();
        for (int pos = 0; pos < gameSize; pos++) {
            char posChar = pattern.charAt(pos);
            int poolSize = posChar == 'H' ? hPoolSize : mPoolSize;
            
            Map<Integer, Integer> digitFreq = new HashMap<>();
            for (DrawData draw : history) {
                if (pos < draw.numbers.size()) {
                    digitFreq.merge(draw.numbers.get(pos), 1, Integer::sum);
                }
            }
            
            Set<Integer> pool = digitFreq.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(poolSize)
                .map(Map.Entry::getKey)
                .collect(Collectors.toCollection(LinkedHashSet::new));
            
            pools.put(pos, pool);
        }
        return pools;
    }
    
    private long calculateCombinations(Map<Integer, Set<Integer>> pools) {
        long result = 1;
        for (Set<Integer> pool : pools.values()) {
            result *= pool.size();
        }
        return result;
    }
    
    private boolean isFullHit(List<Integer> draw, Map<Integer, Set<Integer>> pools) {
        for (int pos = 0; pos < draw.size(); pos++) {
            if (!pools.get(pos).contains(draw.get(pos))) {
                return false;
            }
        }
        return true;
    }
    
    private BigDecimal calculatePrize(BigDecimal betLevel, int gameSize) {
        BigDecimal basePrize = gameSize == 3 ? new BigDecimal("900") : new BigDecimal("9000");
        return basePrize.multiply(betLevel).divide(new BigDecimal("1.00"), 2, RoundingMode.HALF_UP);
    }
    
    private static class DrawData {
        final List<Integer> numbers;
        final LocalDate date;
        final int year;
        
        DrawData(List<Integer> numbers, LocalDate date, int year) {
            this.numbers = numbers;
            this.date = date;
            this.year = year;
        }
    }
    
    private static class MonthlyStats {
        final String month;
        int totalDraws = 0;
        int plays = 0;
        int wins = 0;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalPayout = BigDecimal.ZERO;
        
        MonthlyStats(String month) {
            this.month = month;
        }
    }
    
    public Mono<MultiGameBacktestResponse> generateMultiGameBacktest(MultiGameBacktestRequest request) {
        return Mono.fromCallable(() -> {
            log.info("Generating multi-game backtest: games={}, years={}, betLevel={}", 
                request.getGameIds(), request.getYears(), request.getBetLevel());
            
            request.validate();
            
            // Fetch and prepare data for all games
            Map<String, GameBacktestData> gameDataMap = new LinkedHashMap<>();
            
            for (String gameId : request.getGameIds()) {
                StateGamesResponse gameData = lotteryStateService.getLottoGameDrawData(gameId, request.getStateName())
                    .orElseThrow(() -> new IllegalArgumentException("No historical data available for " + gameId));
                
                if (gameData.getLotteryGame() == null || gameData.getLotteryGame().getLotteryDraws() == null) {
                    throw new IllegalArgumentException("No historical data available for " + gameId);
                }
                
                List<LotteryDraw> draws = gameData.getLotteryGame().getLotteryDraws();
                Collections.reverse(draws);
                
                List<DrawData> historicalDraws = draws.stream()
                    .map(draw -> new DrawData(
                        draw.getDrawResults() != null ? draw.getDrawResults() : Collections.emptyList(),
                        draw.getDrawDate(),
                        draw.getDrawDate().getYear()
                    ))
                    .filter(d -> !d.numbers.isEmpty())
                    .collect(Collectors.toList());
                
                int gameSize = detectGameSize(historicalDraws, gameId);
                BigDecimal prize = calculatePrize(request.getBetLevel(), gameSize);
                
                // Filter for requested years
                List<DrawData> yearDraws = historicalDraws.stream()
                    .filter(d -> request.getYears().contains(d.year))
                    .collect(Collectors.toList());
                
                if (yearDraws.isEmpty()) {
                    throw new IllegalArgumentException("No data available for " + gameId + " in years " + request.getYears());
                }
                
                // Build training data and patterns
                // IMPORTANT: Use only historical data BEFORE the year being tested to avoid look-ahead bias
                int trainingSize = 200;
                
                // Find the earliest date in yearDraws
                LocalDate earliestYearDate = yearDraws.stream()
                    .map(d -> d.date)
                    .min(LocalDate::compareTo)
                    .orElse(LocalDate.now(clock));
                
                // Filter training data to only include draws BEFORE the earliest year date
                // Sort to get most recent 200 draws before the year (matches live endpoint logic)
                List<DrawData> trainingData = historicalDraws.stream()
                    .filter(d -> d.date.isBefore(earliestYearDate))
                    .sorted((a, b) -> b.date.compareTo(a.date))  // Sort newest first
                    .limit(trainingSize)
                    .sorted((a, b) -> a.date.compareTo(b.date))  // Reverse to chronological (oldest first)
                    .collect(Collectors.toList());
                
                // If we don't have enough historical data before the year, use what we have
                if (trainingData.isEmpty()) {
                    trainingData = historicalDraws.subList(0, Math.min(trainingSize, historicalDraws.size()));
                }
                
                // Log training data range for verification
                if (!trainingData.isEmpty()) {
                    log.info("=== TRAINING DATA FOR {} (Year {}) ===", gameId, request.getYears());
                    log.info("Earliest year date: {}", earliestYearDate);
                    log.info("Training data range: {} to {} ({} draws)", 
                        trainingData.get(0).date,
                        trainingData.get(trainingData.size() - 1).date,
                        trainingData.size());
                    log.info("Verification: Training ends BEFORE year starts? {}", 
                        trainingData.get(trainingData.size() - 1).date.isBefore(earliestYearDate));
                }
                
                Map<Integer, Set<Integer>> basePools = buildBasePoolsForPatterns(trainingData, gameSize, 7);
                
                List<String> allPatterns = new ArrayList<>();
                for (DrawData draw : historicalDraws) {
                    allPatterns.add(calculatePatternFromPools(draw.numbers, basePools, gameSize));
                }
                
                int yearStartIndex = historicalDraws.indexOf(yearDraws.get(0));
                
                gameDataMap.put(gameId, new GameBacktestData(
                    gameId, historicalDraws, yearDraws, yearStartIndex, 
                    trainingData, basePools, allPatterns, gameSize, prize
                ));
            }
            
            // Determine maxGameOut
            int maxGameOut = request.getMaxGameOut() != null ? request.getMaxGameOut() : 15;
            int hPoolSize = request.getHPoolSize() != null ? request.getHPoolSize() : 6;
            int mPoolSize = request.getMPoolSize() != null ? request.getMPoolSize() : 8;
            
            // Initialize balance tracking
            BigDecimal startingBalance = request.getStartingBalance() != null ? 
                request.getStartingBalance() : new BigDecimal("10000");
            BigDecimal currentBalance = startingBalance;
            BigDecimal peakBalance = startingBalance;
            BigDecimal lowestBalance = startingBalance;
            
            // Collect all unique dates across all games
            Set<LocalDate> allDates = new TreeSet<>();
            for (GameBacktestData data : gameDataMap.values()) {
                data.yearDraws.forEach(d -> allDates.add(d.date));
            }
            
            // Track daily and monthly stats
            Map<LocalDate, MultiGameBacktestResponse.DailyStats> dailyStatsMap = new LinkedHashMap<>();
            Map<String, MultiGameBacktestResponse.MonthlyStats> monthlyStatsMap = new LinkedHashMap<>();
            Map<String, GameStats> gameStatsMap = new LinkedHashMap<>();
            
            // Initialize game stats
            for (String gameId : request.getGameIds()) {
                gameStatsMap.put(gameId, new GameStats(gameId));
            }
            
            // Process each unique date
            for (LocalDate date : allDates) {
                List<String> gamesPlayedToday = new ArrayList<>();
                int dailyPlays = 0;
                int dailyWins = 0;
                BigDecimal dailyCost = BigDecimal.ZERO;
                BigDecimal dailyPayout = BigDecimal.ZERO;
                StringBuilder winLossPattern = new StringBuilder();
                
                for (GameBacktestData data : gameDataMap.values()) {
                    // Find draw for this date
                    DrawData drawForDate = data.yearDraws.stream()
                        .filter(d -> d.date.equals(date))
                        .findFirst()
                        .orElse(null);
                    
                    if (drawForDate == null) continue;
                    
                    int drawIndex = data.yearDraws.indexOf(drawForDate);
                    int globalIndex = data.yearStartIndex + drawIndex;
                    
                    String pattern = data.allPatterns.get(globalIndex);
                    
                    // Calculate game out
                    Map<String, Integer> lastSeen = data.lastSeenMap;
                    int gameOut = lastSeen.containsKey(pattern) ? 
                        globalIndex - lastSeen.get(pattern) : globalIndex;
                    
                    if (gameOut <= maxGameOut) {
                        // Build adaptive pools using only data BEFORE this draw date to avoid look-ahead bias
                        // This simulates generating predictions as they would have been made in real-time
                        List<DrawData> trainingDataForThisDate = data.historicalDraws.stream()
                            .filter(d -> d.date.isBefore(date))
                            .limit(200)
                            .collect(Collectors.toList());
                        
                        // If insufficient historical data, fall back to original training data
                        if (trainingDataForThisDate.size() < 50) {
                            trainingDataForThisDate = data.trainingData;
                        }
                        
                        Map<Integer, Set<Integer>> pools = buildAdaptivePools(
                            pattern, trainingDataForThisDate, data.gameSize, hPoolSize, mPoolSize);
                        
                        long combinations = calculateCombinations(pools);
                        
                        // Log pool details for specific dates to verify look-ahead bias fix
                        if (date.toString().equals("2026-02-15") || date.toString().equals("2026-02-14") || 
                            date.toString().equals("2026-02-13") || date.toString().equals("2026-02-12") ||
                            date.toString().equals("2026-02-11")) {
                            log.info("=== POOL GENERATION FOR {} ({}) ===", date, data.gameId);
                            log.info("PREDICTION DATE: {}", date);
                            log.info("Training data size: {} draws", trainingDataForThisDate.size());
                            if (!trainingDataForThisDate.isEmpty()) {
                                log.info("Training data range: {} to {}", 
                                    trainingDataForThisDate.get(0).date,
                                    trainingDataForThisDate.get(trainingDataForThisDate.size() - 1).date);
                                log.info("VERIFICATION: Latest training date ({}) is BEFORE prediction date ({})? {}", 
                                    trainingDataForThisDate.get(trainingDataForThisDate.size() - 1).date,
                                    date,
                                    trainingDataForThisDate.get(trainingDataForThisDate.size() - 1).date.isBefore(date));
                            }
                            log.info("Pattern: {}, GameOut: {}", pattern, gameOut);
                            log.info("Selected pools: {}", pools);
                            log.info("Combinations: {}", combinations);
                            log.info("Winning numbers on {}: {}", date, drawForDate.numbers);
                            log.info("Result: {}", isFullHit(drawForDate.numbers, pools) ? "WIN" : "LOSS");
                        }
                        BigDecimal cost = request.getBetLevel().multiply(new BigDecimal(combinations));
                        
                        // Check if we have sufficient balance to place this bet
                        BigDecimal balanceAfterDailyCosts = currentBalance.subtract(dailyCost);
                        if (balanceAfterDailyCosts.compareTo(cost) >= 0) {
                            boolean won = isFullHit(drawForDate.numbers, pools);
                            BigDecimal payout = won ? data.prize : BigDecimal.ZERO;
                            
                            // Update daily stats
                            gamesPlayedToday.add(data.gameId);
                            dailyPlays++;
                            dailyCost = dailyCost.add(cost);
                            dailyPayout = dailyPayout.add(payout);
                            if (won) dailyWins++;
                            
                            // Track win/loss pattern
                            winLossPattern.append(won ? "W" : "L");
                            
                            // Update game stats
                            GameStats gameStats = gameStatsMap.get(data.gameId);
                            gameStats.plays++;
                            gameStats.totalCost = gameStats.totalCost.add(cost);
                            gameStats.totalPayout = gameStats.totalPayout.add(payout);
                            if (won) gameStats.wins++;
                        }
                        // If insufficient balance, skip this play (no action needed)
                    }
                    
                    // Update lastSeen for this game
                    lastSeen.put(pattern, globalIndex);
                }
                
                // Record daily stats if any plays were made
                if (dailyPlays > 0) {
                    BigDecimal dailyProfit = dailyPayout.subtract(dailyCost);
                    String status = dailyProfit.compareTo(BigDecimal.ZERO) >= 0 ? "GREEN" : "RED";
                    
                    // Capture starting balance before updating
                    BigDecimal dayStartBalance = currentBalance;
                    
                    // Update running balance
                    currentBalance = currentBalance.subtract(dailyCost).add(dailyPayout);
                    peakBalance = peakBalance.max(currentBalance);
                    lowestBalance = lowestBalance.min(currentBalance);
                    
                    dailyStatsMap.put(date, MultiGameBacktestResponse.DailyStats.builder()
                        .date(date.toString())
                        .gamesPlayed(gamesPlayedToday)
                        .totalPlays(dailyPlays)
                        .totalWins(dailyWins)
                        .totalCost(dailyCost)
                        .totalPayout(dailyPayout)
                        .netProfit(dailyProfit)
                        .status(status)
                        .startingBalance(dayStartBalance)
                        .currentBalance(currentBalance)
                        .winLossPattern(winLossPattern.toString())
                        .build());
                    
                    // Update monthly stats
                    String month = date.toString().substring(0, 7);
                    MultiGameBacktestResponse.MonthlyStats monthStats = monthlyStatsMap.computeIfAbsent(month,
                        k -> MultiGameBacktestResponse.MonthlyStats.builder()
                            .month(k)
                            .totalDates(0)
                            .datesWithPlays(0)
                            .totalPlays(0)
                            .totalWins(0)
                            .totalCost(BigDecimal.ZERO)
                            .totalPayout(BigDecimal.ZERO)
                            .netProfit(BigDecimal.ZERO)
                            .build());
                    
                    monthStats.setDatesWithPlays(monthStats.getDatesWithPlays() + 1);
                    monthStats.setTotalPlays(monthStats.getTotalPlays() + dailyPlays);
                    monthStats.setTotalWins(monthStats.getTotalWins() + dailyWins);
                    monthStats.setTotalCost(monthStats.getTotalCost().add(dailyCost));
                    monthStats.setTotalPayout(monthStats.getTotalPayout().add(dailyPayout));
                }
                
                // Count total dates for monthly stats
                String month = date.toString().substring(0, 7);
                MultiGameBacktestResponse.MonthlyStats monthStats = monthlyStatsMap.computeIfAbsent(month,
                    k -> MultiGameBacktestResponse.MonthlyStats.builder()
                        .month(k)
                        .totalDates(0)
                        .datesWithPlays(0)
                        .totalPlays(0)
                        .totalWins(0)
                        .totalCost(BigDecimal.ZERO)
                        .totalPayout(BigDecimal.ZERO)
                        .netProfit(BigDecimal.ZERO)
                        .build());
                monthStats.setTotalDates(monthStats.getTotalDates() + 1);
            }
            
            // Calculate monthly stats
            int greenMonths = 0, redMonths = 0;
            for (MultiGameBacktestResponse.MonthlyStats monthStats : monthlyStatsMap.values()) {
                BigDecimal profit = monthStats.getTotalPayout().subtract(monthStats.getTotalCost());
                monthStats.setNetProfit(profit);
                
                BigDecimal winRate = monthStats.getTotalPlays() > 0 ?
                    new BigDecimal(monthStats.getTotalWins()).multiply(new BigDecimal("100"))
                        .divide(new BigDecimal(monthStats.getTotalPlays()), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
                monthStats.setWinRate(winRate);
                
                String status = profit.compareTo(BigDecimal.ZERO) >= 0 ? "GREEN" : "RED";
                monthStats.setStatus(status);
                if ("GREEN".equals(status)) greenMonths++; else redMonths++;
            }
            
            // Build game results
            List<MultiGameBacktestResponse.GameResult> gameResults = new ArrayList<>();
            for (GameStats stats : gameStatsMap.values()) {
                BigDecimal netProfit = stats.totalPayout.subtract(stats.totalCost);
                BigDecimal winRate = stats.plays > 0 ?
                    new BigDecimal(stats.wins).multiply(new BigDecimal("100"))
                        .divide(new BigDecimal(stats.plays), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
                BigDecimal roi = stats.totalCost.compareTo(BigDecimal.ZERO) > 0 ?
                    netProfit.multiply(new BigDecimal("100"))
                        .divide(stats.totalCost, 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
                
                gameResults.add(MultiGameBacktestResponse.GameResult.builder()
                    .gameId(stats.gameId)
                    .totalDraws(stats.totalDraws)
                    .plays(stats.plays)
                    .wins(stats.wins)
                    .winRate(winRate)
                    .totalCost(stats.totalCost)
                    .totalPayout(stats.totalPayout)
                    .netProfit(netProfit)
                    .roi(roi)
                    .build());
            }
            
            // Calculate portfolio summary
            int totalPlays = gameStatsMap.values().stream().mapToInt(s -> s.plays).sum();
            int totalWins = gameStatsMap.values().stream().mapToInt(s -> s.wins).sum();
            BigDecimal totalCost = gameStatsMap.values().stream()
                .map(s -> s.totalCost).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalPayout = gameStatsMap.values().stream()
                .map(s -> s.totalPayout).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal netProfit = totalPayout.subtract(totalCost);
            
            BigDecimal overallWinRate = totalPlays > 0 ?
                new BigDecimal(totalWins).multiply(new BigDecimal("100"))
                    .divide(new BigDecimal(totalPlays), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            BigDecimal roi = totalCost.compareTo(BigDecimal.ZERO) > 0 ?
                netProfit.multiply(new BigDecimal("100"))
                    .divide(totalCost, 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            
            int datesWithPlays = dailyStatsMap.size();
            int datesSkipped = allDates.size() - datesWithPlays;
            BigDecimal avgPlaysPerDate = datesWithPlays > 0 ?
                new BigDecimal(totalPlays).divide(new BigDecimal(datesWithPlays), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            BigDecimal avgCostPerDate = datesWithPlays > 0 ?
                totalCost.divide(new BigDecimal(datesWithPlays), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            
            MultiGameBacktestResponse.PortfolioSummary portfolioSummary = MultiGameBacktestResponse.PortfolioSummary.builder()
                .totalUniqueDates(allDates.size())
                .datesWithPlays(datesWithPlays)
                .datesSkipped(datesSkipped)
                .totalPlays(totalPlays)
                .totalWins(totalWins)
                .overallWinRate(overallWinRate)
                .totalCost(totalCost)
                .totalPayout(totalPayout)
                .netProfit(netProfit)
                .roi(roi)
                .avgPlaysPerDate(avgPlaysPerDate)
                .avgCostPerDate(avgCostPerDate)
                .greenMonths(greenMonths)
                .redMonths(redMonths)
                .startingBalance(startingBalance)
                .endingBalance(currentBalance)
                .peakBalance(peakBalance)
                .lowestBalance(lowestBalance)
                .build();
            
            return MultiGameBacktestResponse.builder()
                .gameIds(request.getGameIds())
                .stateName(request.getStateName())
                .betLevel(request.getBetLevel())
                .years(request.getYears())
                .portfolioSummary(portfolioSummary)
                .gameResults(gameResults)
                .dailyBreakdown(new ArrayList<>(dailyStatsMap.values()))
                .monthlyBreakdown(new ArrayList<>(monthlyStatsMap.values()))
                .build();
                
        }).subscribeOn(Schedulers.boundedElastic());
    }
    
    private static class GameBacktestData {
        final String gameId;
        final List<DrawData> historicalDraws;
        final List<DrawData> yearDraws;
        final int yearStartIndex;
        final List<DrawData> trainingData;
        final Map<Integer, Set<Integer>> basePools;
        final List<String> allPatterns;
        final int gameSize;
        final BigDecimal prize;
        final Map<String, Integer> lastSeenMap = new HashMap<>();
        
        GameBacktestData(String gameId, List<DrawData> historicalDraws, List<DrawData> yearDraws,
                        int yearStartIndex, List<DrawData> trainingData, Map<Integer, Set<Integer>> basePools,
                        List<String> allPatterns, int gameSize, BigDecimal prize) {
            this.gameId = gameId;
            this.historicalDraws = historicalDraws;
            this.yearDraws = yearDraws;
            this.yearStartIndex = yearStartIndex;
            this.trainingData = trainingData;
            this.basePools = basePools;
            this.allPatterns = allPatterns;
            this.gameSize = gameSize;
            this.prize = prize;
        }
    }
    
    private static class GameStats {
        final String gameId;
        int totalDraws = 0;
        int plays = 0;
        int wins = 0;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalPayout = BigDecimal.ZERO;
        
        GameStats(String gameId) {
            this.gameId = gameId;
        }
    }
}
