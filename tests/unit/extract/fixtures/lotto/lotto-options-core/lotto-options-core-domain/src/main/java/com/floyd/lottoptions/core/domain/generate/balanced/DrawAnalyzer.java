package com.floyd.lottoptions.core.domain.generate.balanced;

import com.floyd.lottoptions.core.domain.draw.Draw;

import java.util.List;

/**
 * Records how a draw history fared against a game's balanced spreads.
 */
final class DrawAnalyzer {

    private DrawAnalyzer() {
    }

    /**
     * Goes through the draws in order and, for each spread, counts a hit and resets its games
     * out when the draw has that spread, or adds one to its games out when it does not.
     *
     * @param draws    the draws, in the order to count them
     * @param patterns the spreads to update
     */
    static void analyzeDraws(List<Draw> draws, List<Pattern> patterns) {
        for (Draw draw : draws) {
            int[] result = draw.numbers().stream()
                    .mapToInt(Integer::intValue)
                    .toArray();

            for (Pattern pattern : patterns) {
                if (pattern.matches(result)) {
                    pattern.incrementHitCount();
                    pattern.resetGamesOut();
                } else {
                    pattern.incrementGamesOut();
                }
            }
        }
    }
}
