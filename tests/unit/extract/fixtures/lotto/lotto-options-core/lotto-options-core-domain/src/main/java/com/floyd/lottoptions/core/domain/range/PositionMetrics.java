package com.floyd.lottoptions.core.domain.range;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;

/**
 * How the analyzed numbers at one position of the draws spread over the ranges.
 *
 * @param position       the position, {@code 1} for the first number a draw lists
 * @param mostLikely     up to three ranges the position hit, the most often first; ranges hit
 *                       equally often smallest first
 * @param leastLikely    up to three other ranges, the least often first (never hit included);
 *                       ranges hit equally often smallest first
 * @param frequencies    every range with the share of draws whose number at the position fell
 *                       in it, smallest range first
 * @param average        the average number at the position; {@code 0} without one
 * @param standardDeviation the numbers' population standard deviation; {@code 0} with fewer
 *                       than two
 * @param lastDrawn      the number at the position in the latest draw that has one
 * @param lastDrawnRange the range of {@code lastDrawn}, empty when it is below 1; it may lie
 *                       above every range (see {@link Ranges#of})
 */
public record PositionMetrics(int position, List<Range> mostLikely, List<Range> leastLikely,
                              Map<Range, Double> frequencies, double average, double standardDeviation,
                              OptionalInt lastDrawn, Optional<Range> lastDrawnRange) {

    public PositionMetrics {
        mostLikely = List.copyOf(mostLikely);
        leastLikely = List.copyOf(leastLikely);
        frequencies = Collections.unmodifiableMap(new LinkedHashMap<>(frequencies));
        Objects.requireNonNull(lastDrawn, "lastDrawn");
        Objects.requireNonNull(lastDrawnRange, "lastDrawnRange");
    }
}
