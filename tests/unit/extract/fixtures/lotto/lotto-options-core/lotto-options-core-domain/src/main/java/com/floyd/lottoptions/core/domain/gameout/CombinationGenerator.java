package com.floyd.lottoptions.core.domain.gameout;

import com.floyd.lottoptions.core.domain.draw.Draw;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pure, stateless generator of candidate number combinations for a game-out play (FR-026).
 *
 * <p>Builds the adaptive per-position number pools from a Hit/Miss pattern (digit
 * pools for digit-based games, whole-number pools for large-pool games), expands
 * them into the full set of positional combinations, and computes per-combination
 * cost inputs (prize, full-hit detection).</p>
 *
 * <p>Extracted verbatim from {@code GameOutRecommendationService}; behavior is
 * identical. A plain stateless class (ADR-0008): a single instance is safely
 * shared and trivially unit-testable.</p>
 */
public final class CombinationGenerator {

    public Map<String, Set<Integer>> buildAdaptivePools(String pattern, List<List<Integer>> history,
                                                 int gameSize, int hPoolSize, int mPoolSize) {
        Map<String, Set<Integer>> pools = new LinkedHashMap<>();

        for (int pos = 0; pos < gameSize; pos++) {
            char posChar = pattern.charAt(pos);
            int poolSize = posChar == 'H' ? hPoolSize : mPoolSize;

            Map<Integer, Integer> digitFreq = new HashMap<>();
            for (List<Integer> draw : history) {
                if (pos < draw.size()) {
                    digitFreq.merge(draw.get(pos), 1, Integer::sum);
                }
            }

            Set<Integer> pool = digitFreq.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(poolSize)
                .map(Map.Entry::getKey)
                .collect(Collectors.toCollection(LinkedHashSet::new));

            pools.put("position" + pos, pool);
        }

        return pools;
    }

    public Map<String, Set<Integer>> buildAdaptivePoolsFromHistory(String pattern, List<Draw> history,
                                                            int gameSize, int hPoolSize, int mPoolSize) {
        Map<String, Set<Integer>> pools = new LinkedHashMap<>();
        for (int pos = 0; pos < gameSize; pos++) {
            char posChar = pattern.charAt(pos);
            int poolSize = posChar == 'H' ? hPoolSize : mPoolSize;

            Map<Integer, Integer> digitFreq = new HashMap<>();
            for (Draw draw : history) {
                if (pos < draw.numbers().size()) {
                    digitFreq.merge(draw.numbers().get(pos), 1, Integer::sum);
                }
            }

            Set<Integer> pool = digitFreq.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(poolSize)
                .map(Map.Entry::getKey)
                .collect(Collectors.toCollection(LinkedHashSet::new));

            pools.put("position" + pos, pool);
        }
        return pools;
    }

    public Map<String, Set<Integer>> buildAdaptiveWholeNumberPools(
            String pattern,
            List<List<Integer>> history,
            int gameSize,
            int hPoolSize,
            int mPoolSize,
            int globalPoolLimit,
            int maxNumberRange) {

        Map<Integer, Set<Integer>> probableDigitsPerPosition = new HashMap<>();

        for (int pos = 0; pos < gameSize; pos++) {
            char posChar = pattern.charAt(pos);
            int digitPoolSize = posChar == 'H' ? hPoolSize : mPoolSize;

            Map<Integer, Integer> digitFreq = new HashMap<>();
            for (List<Integer> draw : history) {
                if (pos < draw.size()) {
                    int number = draw.get(pos);
                    int lastDigit = number % 10;
                    digitFreq.merge(lastDigit, 1, Integer::sum);
                }
            }

            Set<Integer> probableDigits = digitFreq.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(digitPoolSize)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());

            probableDigitsPerPosition.put(pos, probableDigits);
        }

        Map<Integer, Double> globalNumberScores = new HashMap<>();

        for (int number = 1; number <= maxNumberRange; number++) {
            double score = 0.0;
            int lastDigit = number % 10;

            for (int pos = 0; pos < gameSize; pos++) {
                Set<Integer> probableDigits = probableDigitsPerPosition.get(pos);

                if (probableDigits.contains(lastDigit)) {
                    final int finalNumber = number;
                    final int finalPos = pos;
                    long posFrequency = history.stream()
                        .filter(draw -> finalPos < draw.size() && draw.get(finalPos).equals(finalNumber))
                        .count();

                    double frequencyScore = (double) posFrequency / history.size();
                    score += frequencyScore;
                }
            }

            if (score > 0) {
                globalNumberScores.put(number, score);
            }
        }

        Set<Integer> globalPool = globalNumberScores.entrySet().stream()
            .sorted(Map.Entry.<Integer, Double>comparingByValue().reversed())
            .limit(globalPoolLimit)
            .map(Map.Entry::getKey)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, Set<Integer>> positionalPools = new LinkedHashMap<>();

        for (int pos = 0; pos < gameSize; pos++) {
            Set<Integer> probableDigits = probableDigitsPerPosition.get(pos);

            Set<Integer> posPool = globalPool.stream()
                .filter(number -> probableDigits.contains(number % 10))
                .collect(Collectors.toCollection(LinkedHashSet::new));

            if (posPool.size() < 2) {
                final int finalPos = pos;
                Map<Integer, Integer> numberFreq = new HashMap<>();
                for (List<Integer> draw : history) {
                    if (finalPos < draw.size()) {
                        int number = draw.get(finalPos);
                        if (probableDigits.contains(number % 10)) {
                            numberFreq.merge(number, 1, Integer::sum);
                        }
                    }
                }

                Set<Integer> topNumbers = numberFreq.entrySet().stream()
                    .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                    .limit(2)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toSet());

                posPool.addAll(topNumbers);
            }

            positionalPools.put("position" + pos, posPool);
        }

        return positionalPools;
    }

    public List<List<Integer>> generateCombinations(Map<String, Set<Integer>> pools, int gameSize) {
        List<List<Integer>> result = new ArrayList<>();
        generateCombinationsRecursive(pools, gameSize, 0, new ArrayList<>(), result);
        return result;
    }

    private void generateCombinationsRecursive(Map<String, Set<Integer>> pools, int gameSize,
                                               int position, List<Integer> current, List<List<Integer>> result) {
        if (position == gameSize) {
            result.add(new ArrayList<>(current));
            return;
        }

        Set<Integer> pool = pools.get("position" + position);
        if (pool != null) {
            for (Integer digit : pool) {
                current.add(digit);
                generateCombinationsRecursive(pools, gameSize, position + 1, current, result);
                current.remove(current.size() - 1);
            }
        }
    }

    public BigDecimal calculatePrize(BigDecimal betLevel, int gameSize) {
        BigDecimal basePrize = gameSize == 3 ? new BigDecimal("900") : new BigDecimal("9000");
        return basePrize.multiply(betLevel).divide(new BigDecimal("1.00"), 2, RoundingMode.HALF_UP);
    }

    public boolean isFullHit(List<Integer> draw, Map<String, Set<Integer>> pools) {
        for (int pos = 0; pos < draw.size(); pos++) {
            Set<Integer> pool = pools.get("position" + pos);
            if (pool == null || !pool.contains(draw.get(pos))) {
                return false;
            }
        }
        return true;
    }
}
