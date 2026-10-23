package com.floyd.lottoptions.core.domain.pattern;

import com.floyd.lottoptions.core.domain.game.Game;

/**
 * The high/low pattern of each draw: how many of its numbers are low and how many high, for
 * example {@code 2 Low 3 High}. A number is low up to the field's midpoint
 * {@code (min + max) / 2}, rounded down. Reports the patterns seen within the last 601 draws.
 */
public final class HighLowPatternAnalyzer extends PatternAnalyzer {

    private static final int MAX_GAMES_SINCE_LAST_APPEARANCE = 600;

    private final int midpoint;

    /**
     * @param game                  the game whose draws are analyzed
     * @param probabilityCalculator how a pattern's probability is calculated
     */
    public HighLowPatternAnalyzer(Game game, ProbabilityCalculator probabilityCalculator) {
        super(game, probabilityCalculator);
        this.midpoint = (game.field().min() + game.field().max()) / 2;
    }

    @Override
    protected boolean inFirstGroup(int number) {
        return number <= midpoint;
    }

    @Override
    protected String name(Split split) {
        return split.first() + " Low " + split.second() + " High";
    }

    @Override
    protected boolean isRecent(int gamesSinceLastAppearance) {
        return gamesSinceLastAppearance <= MAX_GAMES_SINCE_LAST_APPEARANCE;
    }
}
