package com.floyd.lottoptions.core.domain.pattern;

import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.game.GameFormat;

/**
 * The chance that one draw of a game shows a pattern.
 */
public interface ProbabilityCalculator {

    /** A digit game of up to this many digits draws with replacement. */
    int MAX_DIGITS_WITH_REPLACEMENT = 4;

    /**
     * Picks the calculator for a game: a digit game of up to 4 digits draws its digits with
     * replacement; every other game draws distinct numbers.
     *
     * @param game the game
     * @return the game's calculator
     */
    static ProbabilityCalculator forGame(Game game) {
        boolean withReplacement = game.format() == GameFormat.DIGIT
                && game.pickCount() <= MAX_DIGITS_WITH_REPLACEMENT;
        return withReplacement ? new DigitProbabilityCalculator() : new StandardProbabilityCalculator();
    }

    /**
     * Calculates the chance that one draw shows a pattern.
     *
     * @param pattern how many drawn numbers fall into each group
     * @param field   how many numbers of the game's field fall into each group
     * @param game    the game, whose field size and pick count give the draws possible
     * @return the probability; {@code 0} when the game allows no draw
     */
    double probability(Split pattern, Split field, Game game);
}
