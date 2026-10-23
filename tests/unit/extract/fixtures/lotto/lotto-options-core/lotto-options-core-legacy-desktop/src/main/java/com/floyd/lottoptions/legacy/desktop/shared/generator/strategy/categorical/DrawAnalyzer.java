package com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical;

import com.floyd.persistence.model.LotteryDraw;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Analyzes historical lottery draws to categorize them based on predefined categorical patterns.
 * This class processes a list of draws and determines which patterns each draw matches. It tracks the hit count,
 * games since last hit, and the actual draws that correspond to each pattern.
 */
public class DrawAnalyzer {
    /**
     * A map that stores the relationship between a pattern and the list of lottery draws that match it.
     * The key is the {@link Pattern} object, and the value is a list of integer arrays, where each array
     * represents a lottery draw's numbers.
     */
    private final Map<Pattern, List<int[]>> patternToDrawsMap = new HashMap<>();

    /**
     * Analyzes a list of lottery draws against a list of predefined patterns.
     * For each draw, it checks against every pattern. If a pattern matches, its hit count is incremented
     * and its 'games out' count is reset. If it doesn't match, the 'games out' count is incremented.
     * The draw is stored in a map associated with the matched pattern.
     *
     * @param draws    The list of {@link LotteryDraw} objects to be analyzed.
     * @param patterns The list of {@link Pattern} objects to match against.
     */
    public void analyzeDraws(List<LotteryDraw> draws, List<Pattern> patterns) {
        for (LotteryDraw draw : draws) {
            int[] result = draw.getDrawResults().stream()
                    .mapToInt(Integer::intValue)
                    .toArray();

            for (Pattern pattern : patterns) {
                if (pattern.matches(result)) {
                    pattern.incrementHitCount();
                    pattern.resetGamesOut();
                    patternToDrawsMap.computeIfAbsent(pattern, k -> new ArrayList<>()).add(result);
                } else {
                    pattern.incrementGamesOut();
                }
            }
        }
    }

    /**
     * Retrieves all historical draws that have matched a specific pattern.
     *
     * @param pattern The {@link Pattern} for which to retrieve the matching draws.
     * @return A list of integer arrays, where each array represents a draw's numbers that matched the pattern.
     *         Returns an empty list if no draws matched the pattern.
     */
    public List<int[]> getDrawsForPattern(Pattern pattern) {
        return patternToDrawsMap.getOrDefault(pattern, new ArrayList<>());
    }
}
