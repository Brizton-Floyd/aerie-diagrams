package com.floyd.lottoptions.core.domain.range;

import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * One draw as a range analysis sees it: the numbers it buckets and how many fell in each range.
 *
 * @param date    the draw's date
 * @param numbers the numbers bucketed: the {@link AnalysisType}'s numbers at the analyzed
 *                positions
 * @param hits    every range with the numbers that fell in it, smallest range first
 */
public record AnalyzedDraw(LocalDate date, List<Integer> numbers, Map<Range, Integer> hits) {

    public AnalyzedDraw {
        Objects.requireNonNull(date, "date");
        numbers = List.copyOf(numbers);
        hits = Collections.unmodifiableMap(new LinkedHashMap<>(hits));
    }

    /**
     * @param range a range
     * @return whether at least one number fell in the range
     */
    public boolean hit(Range range) {
        return hits.getOrDefault(range, 0) > 0;
    }
}
