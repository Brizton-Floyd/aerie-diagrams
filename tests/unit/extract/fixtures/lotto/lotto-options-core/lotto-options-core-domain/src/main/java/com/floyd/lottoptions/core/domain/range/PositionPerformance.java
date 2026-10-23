package com.floyd.lottoptions.core.domain.range;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;

/**
 * Per-position performance: for each position of the draws, how its analyzed numbers spread
 * over the ranges. A position is the rank of a number within its draw's list: position 1 is the
 * first number the draw lists, which for a pick-k game is its smallest.
 */
public final class PositionPerformance {

    /** The most and the least likely ranges listed per position. */
    private static final int LIKELY_RANGES = 3;

    private static final Comparator<Map.Entry<Range, Double>> BY_RANGE =
            Comparator.comparingInt(entry -> entry.getKey().first());

    private PositionPerformance() {
    }

    /**
     * @param ranges        the ranges the numbers are bucketed into
     * @param newestFirst   each draw's analyzed numbers at every position, latest draw first
     * @param positionCount the positions to report, from 1
     * @return one entry per position, the first position first
     */
    public static List<PositionMetrics> of(Ranges ranges, List<List<Integer>> newestFirst, int positionCount) {
        List<PositionMetrics> positions = new ArrayList<>(Math.max(0, positionCount));
        for (int position = 1; position <= positionCount; position++) {
            positions.add(metricsOf(position, ranges, newestFirst));
        }
        return positions;
    }

    private static PositionMetrics metricsOf(int position, Ranges ranges, List<List<Integer>> newestFirst) {
        List<Integer> numbers = new ArrayList<>();
        for (List<Integer> draw : newestFirst) {
            if (position - 1 < draw.size()) {
                numbers.add(draw.get(position - 1));
            }
        }
        Map<Range, Integer> hits = ranges.hits(numbers);

        Map<Range, Double> frequencies = new LinkedHashMap<>();
        int totalDraws = newestFirst.size();
        hits.forEach((range, count) -> frequencies.put(range, totalDraws > 0 ? (double) count / totalDraws : 0.0));

        List<Range> mostLikely = frequencies.entrySet().stream()
                .filter(entry -> entry.getValue() > 0.0)
                .sorted(Map.Entry.<Range, Double>comparingByValue().reversed().thenComparing(BY_RANGE))
                .limit(LIKELY_RANGES)
                .map(Map.Entry::getKey)
                .toList();
        Set<Range> mostLikelySet = new HashSet<>(mostLikely);
        List<Range> leastLikely = frequencies.entrySet().stream()
                .sorted(Map.Entry.<Range, Double>comparingByValue().thenComparing(BY_RANGE))
                .filter(entry -> !mostLikelySet.contains(entry.getKey()))
                .limit(LIKELY_RANGES)
                .map(Map.Entry::getKey)
                .toList();

        double average = numbers.stream().mapToInt(Integer::intValue).average().orElse(0.0);
        double standardDeviation = numbers.size() > 1
                ? Math.sqrt(numbers.stream().mapToDouble(number -> Math.pow(number - average, 2)).average().orElse(0.0))
                : 0.0;

        OptionalInt lastDrawn = numbers.isEmpty() ? OptionalInt.empty() : OptionalInt.of(numbers.get(0));
        Optional<Range> lastDrawnRange = numbers.isEmpty() ? Optional.empty() : ranges.of(numbers.get(0));
        return new PositionMetrics(position, mostLikely, leastLikely, frequencies, average, standardDeviation,
                lastDrawn, lastDrawnRange);
    }
}
