package com.floyd.lottoptions.core.application.gameout;

import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.draw.DrawHistorySource;
import com.floyd.lottoptions.core.domain.draw.DrawHistoryUnavailableException;
import com.floyd.lottoptions.core.domain.draw.UnknownGameException;
import com.floyd.lottoptions.core.domain.gameout.CombinationGenerator;
import com.floyd.lottoptions.core.domain.gameout.CoverageAnalyzer;
import com.floyd.lottoptions.core.domain.gameout.GameOutRecommendation;
import com.floyd.lottoptions.core.domain.gameout.GameOutRequest;
import com.floyd.lottoptions.core.domain.gameout.GameType;
import com.floyd.lottoptions.core.domain.gameout.HistoricalPerformance;
import com.floyd.lottoptions.core.domain.gameout.HistoricalPerformanceCalculator;
import com.floyd.lottoptions.core.domain.gameout.PositionalPatternEngine;
import com.floyd.lottoptions.core.domain.gameout.WageringStrategyCalculator;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Use case: recommend whether to play a game's next draw (PLAY or SKIP) and, for PLAY, what to
 * play, from its full draw history.
 */
public final class RecommendGameOut {

    /** The pool size the latest draw's positional pattern is read against. */
    private static final int PATTERN_POOL_SIZE = 7;

    private final DrawHistorySource drawHistorySource;
    private final PositionalPatternEngine positionalPatternEngine = new PositionalPatternEngine();
    private final CombinationGenerator combinationGenerator = new CombinationGenerator();
    private final CoverageAnalyzer coverageAnalyzer = new CoverageAnalyzer();
    private final HistoricalPerformanceCalculator historicalPerformanceCalculator;

    /**
     * @param drawHistorySource where draw histories are read from
     * @param clock             supplies the year a replay falls back to
     */
    public RecommendGameOut(DrawHistorySource drawHistorySource, Clock clock) {
        this.drawHistorySource = Objects.requireNonNull(drawHistorySource, "drawHistorySource");
        this.historicalPerformanceCalculator = new HistoricalPerformanceCalculator(
            positionalPatternEngine, combinationGenerator, new WageringStrategyCalculator(),
            Objects.requireNonNull(clock, "clock"));
    }

    /**
     * Recommends a game's next draw.
     *
     * @param request the game and the recommendation's settings
     * @return the recommendation
     * @throws IllegalArgumentException        if the source answered without the game or the game
     *                                         has no draws
     * @throws UnknownGameException            if the source has no such game in the state
     * @throws DrawHistoryUnavailableException if the source is down or failing
     */
    public GameOutRecommendation recommend(GameOutRequest request) {
        DrawHistory history = drawHistorySource.load(request.game())
            .orElseThrow(() -> new IllegalArgumentException("No historical data available for " + request.gameId()));

        if (history.isEmpty()) {
            throw new IllegalArgumentException("No draw data available for " + request.gameId());
        }

        List<Draw> newestFirst = new ArrayList<>(history.oldestFirst());
        Collections.reverse(newestFirst);

        List<List<Integer>> historicalDraws = newestFirst.stream()
            .map(draw -> (List<Integer>) new ArrayList<>(draw.numbers()))
            .filter(numbers -> !numbers.isEmpty())
            .collect(Collectors.toList());

        int gameSize = positionalPatternEngine.detectGameSize(historicalDraws, request.gameId());
        GameType gameType = positionalPatternEngine.detectGameType(request.gameId());
        int maxNumberRange = positionalPatternEngine.detectMaxNumberRange(request.gameId());

        // Build base pools (size 7) for pattern detection
        Map<Integer, Set<Integer>> basePools;
        String lastPattern;
        List<Integer> lastDraw = historicalDraws.get(0);

        if (gameType == GameType.LARGE_POOL) {
            basePools = positionalPatternEngine.buildPositionalPoolsFromLastDigits(historicalDraws, gameSize, PATTERN_POOL_SIZE);
            lastPattern = positionalPatternEngine.calculatePatternFromLastDigitPools(lastDraw, basePools, gameSize);
        } else {
            basePools = positionalPatternEngine.buildPositionalPools(historicalDraws, gameSize, PATTERN_POOL_SIZE);
            lastPattern = positionalPatternEngine.calculatePatternFromPools(lastDraw, basePools, gameSize);
        }

        int gameOutValue = positionalPatternEngine.calculateGameOut(lastPattern, historicalDraws, basePools, gameSize, gameType);

        LocalDate lastDrawDate = newestFirst.get(0).date();
        LocalDate nextDrawDate = lastDrawDate.plusDays(1);

        GameOutRecommendation.Metadata metadata = new GameOutRecommendation.Metadata(
            historicalDraws.size(), lastDrawDate, request.hPoolSize(), request.mPoolSize());

        int maxGameOut = request.maxGameOutOrDefault();

        HistoricalPerformance historicalPerformance = null;
        if (request.includeHistoricalPerformance()) {
            historicalPerformance = historicalPerformanceCalculator.calculateHistoricalPerformance(
                request, newestFirst, historicalDraws, gameSize, maxGameOut, gameType);
        }

        GameOutRecommendation.Decision decision;
        if (gameOutValue > maxGameOut) {
            decision = new GameOutRecommendation.Skip(
                String.format("Game out value (%d) above threshold (%d)", gameOutValue, maxGameOut));
        } else if (gameType == GameType.LARGE_POOL) {
            decision = poolPlay(request, lastPattern, historicalDraws, gameSize, maxNumberRange);
        } else {
            decision = combinationPlay(request, lastPattern, historicalDraws, gameSize);
        }

        return new GameOutRecommendation(request.gameId(), nextDrawDate, gameOutValue, maxGameOut, metadata,
            historicalPerformance, decision);
    }

    private GameOutRecommendation.PoolPlay poolPlay(GameOutRequest request, String lastPattern,
                                                    List<List<Integer>> historicalDraws, int gameSize,
                                                    int maxNumberRange) {
        int poolSize = request.poolSize() != null ? request.poolSize() : (gameSize == 6 ? 20 : 15);

        Map<String, Set<Integer>> pools = combinationGenerator.buildAdaptiveWholeNumberPools(
            lastPattern, historicalDraws, gameSize,
            request.hPoolSize(), request.mPoolSize(),
            poolSize, maxNumberRange);

        Set<Integer> globalPool = new LinkedHashSet<>();
        for (Set<Integer> posPool : pools.values()) {
            globalPool.addAll(posPool);
        }

        List<Integer> poolNumbers = new ArrayList<>(globalPool);
        Collections.sort(poolNumbers);

        Map<String, List<Integer>> positionalBreakdown = new LinkedHashMap<>();
        for (Map.Entry<String, Set<Integer>> entry : pools.entrySet()) {
            List<Integer> posList = new ArrayList<>(entry.getValue());
            Collections.sort(posList);
            positionalBreakdown.put(entry.getKey(), posList);
        }

        return new GameOutRecommendation.PoolPlay(request.betLevel(), lastPattern, poolNumbers, positionalBreakdown,
            request.includeHistoricalPerformance()
                ? coverageAnalyzer.calculateCoverageAnalysis(globalPool, historicalDraws, gameSize)
                : null);
    }

    private GameOutRecommendation.CombinationPlay combinationPlay(GameOutRequest request, String lastPattern,
                                                                  List<List<Integer>> historicalDraws, int gameSize) {
        Map<String, Set<Integer>> pools = combinationGenerator.buildAdaptivePools(
            lastPattern, historicalDraws, gameSize,
            request.hPoolSize(), request.mPoolSize());

        List<List<Integer>> combinations = combinationGenerator.generateCombinations(pools, gameSize);

        BigDecimal totalCost = request.betLevel().multiply(new BigDecimal(combinations.size()));
        BigDecimal prize = combinationGenerator.calculatePrize(request.betLevel(), gameSize);

        return new GameOutRecommendation.CombinationPlay(request.betLevel(), prize, lastPattern, pools, combinations,
            totalCost);
    }
}
