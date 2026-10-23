package com.floyd.lottoptions.core.domain.pattern;

import com.floyd.lottoptions.core.domain.game.Game;

/**
 * Probabilities for a digit game of up to 4 digits, whose digits may repeat: the patterns'
 * draws over all draws, counted as combinations with repetition.
 */
public final class DigitProbabilityCalculator implements ProbabilityCalculator {

    @Override
    public double probability(Split pattern, Split field, Game game) {
        long patternDraws = Combinations.chooseWithRepetition(field.first(), pattern.first())
                * Combinations.chooseWithRepetition(field.second(), pattern.second());
        long allDraws = Combinations.chooseWithRepetition(
                game.field().max() - game.field().min() + 1, game.pickCount());
        return allDraws == 0 ? 0.0 : (double) patternDraws / allDraws;
    }
}
