package com.floyd.lottoptions.core.application.range;

import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.range.AnalyzedDraw;
import com.floyd.lottoptions.core.domain.range.PositionMetrics;
import com.floyd.lottoptions.core.domain.range.Range;
import com.floyd.lottoptions.core.domain.range.RangeMetrics;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * A game's range analysis: each analyzed draw's numbers bucketed into ranges.
 *
 * @param game          the game
 * @param largestNumber the largest number the ranges cover
 * @param positionCount the numbers per draw
 * @param ranges        the ranges, smallest first
 * @param draws         the analyzed draws, latest first
 * @param performance   the per-range and per-position performance, when the query asked for it
 */
public record RangeAnalysis(Game game, int largestNumber, int positionCount, List<Range> ranges,
                            List<AnalyzedDraw> draws, Optional<Performance> performance) {

    public RangeAnalysis {
        Objects.requireNonNull(game, "game");
        ranges = List.copyOf(ranges);
        draws = List.copyOf(draws);
        Objects.requireNonNull(performance, "performance");
    }

    /**
     * How the ranges and the positions performed over the analyzed draws.
     *
     * @param byRange    every range with its metrics, smallest range first
     * @param byPosition every position's metrics, over all the draw's numbers whatever the
     *                   query's positions, the first position first
     */
    public record Performance(Map<Range, RangeMetrics> byRange, List<PositionMetrics> byPosition) {

        public Performance {
            byRange = Collections.unmodifiableMap(new LinkedHashMap<>(byRange));
            byPosition = List.copyOf(byPosition);
        }
    }
}
