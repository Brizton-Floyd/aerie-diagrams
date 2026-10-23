package com.floyd.lottoptions.core.domain.gameout;

import com.floyd.lottoptions.core.domain.draw.Draw;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pure, stateless engine for positional game-out pattern analysis (FR-026).
 *
 * <p>Builds positional base pools, derives per-draw Hit/Miss patterns, computes
 * game-out values, and detects a game's size / type / number range. It handles
 * both digit-based games (analyzed on the digit itself) and large-pool games
 * (analyzed on each number's last digit).</p>
 *
 * <p>Extracted verbatim from {@code GameOutRecommendationService} to keep the
 * orchestrator thin; behavior is identical. A plain stateless class (ADR-0008): a single
 * instance is safely shared and trivially unit-testable.</p>
 */
public final class PositionalPatternEngine {

    public Map<Integer, Set<Integer>> buildPositionalPools(List<List<Integer>> draws, int gameSize, int poolSize) {
        Map<Integer, Set<Integer>> pools = new LinkedHashMap<>();

        for (int pos = 0; pos < gameSize; pos++) {
            Map<Integer, Integer> digitFreq = new HashMap<>();

            for (List<Integer> draw : draws) {
                if (pos < draw.size()) {
                    digitFreq.merge(draw.get(pos), 1, Integer::sum);
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

    public String calculatePatternFromPools(List<Integer> draw, Map<Integer, Set<Integer>> basePools, int gameSize) {
        StringBuilder pattern = new StringBuilder();

        for (int pos = 0; pos < gameSize; pos++) {
            int digit = draw.get(pos);
            boolean isHit = basePools.get(pos).contains(digit);
            pattern.append(isHit ? 'H' : 'M');
        }

        return pattern.toString();
    }

    public int calculateGameOut(String pattern, List<List<Integer>> history,
                         Map<Integer, Set<Integer>> basePools, int gameSize, GameType gameType) {
        // Search from index 1 onwards (skip index 0 which is the current draw we just analyzed)
        // Game out = number of draws since the pattern was last seen (excluding current draw)
        for (int i = 1; i < history.size(); i++) {
            String p;
            if (gameType == GameType.LARGE_POOL) {
                p = calculatePatternFromLastDigitPools(history.get(i), basePools, gameSize);
            } else {
                p = calculatePatternFromPools(history.get(i), basePools, gameSize);
            }

            if (p.equals(pattern)) {
                return i; // Found at position i = i draws ago
            }
        }

        // Pattern never seen before - return a large number to trigger SKIP
        return 9999;
    }

    public int detectGameSize(List<List<Integer>> draws, String gameName) {
        if (!draws.isEmpty() && !draws.get(0).isEmpty()) {
            return draws.get(0).size();
        }
        return gameName.toLowerCase().contains("pick 3") ? 3 : 4;
    }

    public GameType detectGameType(String gameName) {
        int maxRange = detectMaxNumberRange(gameName);
        return maxRange <= 10 ? GameType.DIGIT_BASED : GameType.LARGE_POOL;
    }

    public int detectMaxNumberRange(String gameName) {
        String gameLower = gameName.toLowerCase();
        if (gameLower.contains("lotto texas")) {
            return 54;
        } else if (gameLower.contains("mega millions")) {
            return 70;
        } else if (gameLower.contains("powerball")) {
            return 69;
        } else if (gameLower.contains("texas two step") || gameLower.contains("all pick") || gameLower.contains("cash five")) {
            return 35;
        } else {
            return 10;
        }
    }

    public Map<Integer, Set<Integer>> buildPositionalPoolsFromLastDigits(
            List<List<Integer>> draws, int gameSize, int poolSize) {
        Map<Integer, Set<Integer>> pools = new LinkedHashMap<>();

        for (int pos = 0; pos < gameSize; pos++) {
            Map<Integer, Integer> digitFreq = new HashMap<>();

            for (List<Integer> draw : draws) {
                if (pos < draw.size()) {
                    int number = draw.get(pos);
                    int lastDigit = number % 10;
                    digitFreq.merge(lastDigit, 1, Integer::sum);
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

    public String calculatePatternFromLastDigitPools(
            List<Integer> draw, Map<Integer, Set<Integer>> basePools, int gameSize) {
        StringBuilder pattern = new StringBuilder();

        for (int pos = 0; pos < gameSize; pos++) {
            int number = draw.get(pos);
            int lastDigit = number % 10;
            boolean isHit = basePools.get(pos).contains(lastDigit);
            pattern.append(isHit ? 'H' : 'M');
        }

        return pattern.toString();
    }

    public Map<Integer, Set<Integer>> buildBasePoolsForPatterns(List<Draw> history, int gameSize, int poolSize) {
        Map<Integer, Set<Integer>> pools = new LinkedHashMap<>();
        for (int pos = 0; pos < gameSize; pos++) {
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

            pools.put(pos, pool);
        }
        return pools;
    }

    public int calculateGameOutFromHistory(String pattern, List<Draw> history,
                                    Map<Integer, Set<Integer>> basePools, int gameSize) {
        Map<String, Integer> lastSeen = new HashMap<>();
        for (int i = 0; i < history.size(); i++) {
            String p = calculatePatternFromPools(history.get(i).numbers(), basePools, gameSize);
            lastSeen.put(p, i);
        }
        int lastSeenIndex = lastSeen.getOrDefault(pattern, -1);
        if (lastSeenIndex == -1) {
            return history.size(); // Pattern never seen - return large number
        }
        // Game out = how many draws ago the pattern was seen
        // history.get(0) is most recent, so draws ago = index
        return lastSeenIndex;
    }
}
