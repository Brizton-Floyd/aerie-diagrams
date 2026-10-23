package com.floyd.lottoptions.core.domain.pattern;

import com.floyd.lottoptions.core.domain.game.Game;

/**
 * The odd/even pattern of each draw: how many of its numbers are odd and how many even, for
 * example {@code 3 Odd 2 Even}. Reports the patterns seen within the last 1,000 draws.
 */
public final class OddEvenPatternAnalyzer extends PatternAnalyzer {

    private static final int RECENT_DRAWS = 1000;

    /**
     * @param game                  the game whose draws are analyzed
     * @param probabilityCalculator how a pattern's probability is calculated
     */
    public OddEvenPatternAnalyzer(Game game, ProbabilityCalculator probabilityCalculator) {
        super(game, probabilityCalculator);
    }

    @Override
    protected boolean inFirstGroup(int number) {
        return number % 2 != 0;
    }

    @Override
    protected String name(Split split) {
        return split.first() + " Odd " + split.second() + " Even";
    }

    @Override
    protected boolean isRecent(int gamesSinceLastAppearance) {
        return gamesSinceLastAppearance < RECENT_DRAWS;
    }
}
