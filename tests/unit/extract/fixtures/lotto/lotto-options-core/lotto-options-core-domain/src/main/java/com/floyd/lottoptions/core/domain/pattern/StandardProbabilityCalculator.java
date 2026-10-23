package com.floyd.lottoptions.core.domain.pattern;

import com.floyd.lottoptions.core.domain.game.Game;

/**
 * Probabilities for a game that draws distinct numbers, without replacement: the patterns'
 * draws over all draws, counted with binomial coefficients.
 */
public final class StandardProbabilityCalculator implements ProbabilityCalculator {

    @Override
    public double probability(Split pattern, Split field, Game game) {
        long patternDraws = Combinations.choose(field.first(), pattern.first())
                * Combinations.choose(field.second(), pattern.second());
        long allDraws = Combinations.choose(game.field().max() - game.field().min() + 1, game.pickCount());
        return allDraws == 0 ? 0.0 : (double) patternDraws / allDraws;
    }
}
