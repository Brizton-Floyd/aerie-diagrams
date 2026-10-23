package com.floyd.lottoptions.core.application.range;

import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.core.domain.range.AnalysisType;

import java.util.List;
import java.util.Objects;

/**
 * What a range analysis covers.
 *
 * @param game               the game
 * @param rangeSize          the numbers per range; greater than 0
 * @param positions          the positions whose numbers each draw's range hits count, from 1;
 *                           empty for every position. Positions the draws do not have are
 *                           skipped
 * @param analysisType       which numbers of each draw are bucketed
 * @param maxDraws           how many of the latest draws to analyze; {@code 0} for all
 * @param includePerformance whether to compute the per-range and per-position performance
 */
public record RangeQuery(GameId game, int rangeSize, List<Integer> positions, AnalysisType analysisType,
                         int maxDraws, boolean includePerformance) {

    public RangeQuery {
        Objects.requireNonNull(game, "game");
        Objects.requireNonNull(analysisType, "analysisType");
        positions = List.copyOf(positions);
    }
}
