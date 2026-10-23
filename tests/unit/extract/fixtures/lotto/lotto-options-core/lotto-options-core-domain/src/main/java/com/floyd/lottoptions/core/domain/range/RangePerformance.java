package com.floyd.lottoptions.core.domain.range;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Per-range performance: how each range performed over the analyzed draws, latest draw first.
 */
public final class RangePerformance {

    /** The share of draws a range is expected to hit, as a rough baseline. */
    private static final double BASELINE_HIT_FREQUENCY = 0.2;
    private static final double HOT_FACTOR = 1.2;
    private static final double COLD_FACTOR = 0.8;

    private RangePerformance() {
    }

    /**
     * @param ranges      the ranges, smallest first
     * @param newestFirst the analyzed draws, latest first
     * @return every range with its metrics, in the given order
     */
    public static Map<Range, RangeMetrics> of(List<Range> ranges, List<AnalyzedDraw> newestFirst) {
        Map<Range, RangeMetrics> metrics = new LinkedHashMap<>();
        for (Range range : ranges) {
            metrics.put(range, metricsOf(range, newestFirst));
        }
        return metrics;
    }

    private static RangeMetrics metricsOf(Range range, List<AnalyzedDraw> newestFirst) {
        int totalHits = 0;
        int drawsWithHits = 0;
        List<Integer> gaps = new ArrayList<>();
        int currentGap = 0;
        LocalDate lastHit = null;
        for (AnalyzedDraw draw : newestFirst) {
            int hits = draw.hits().getOrDefault(range, 0);
            totalHits += hits;
            if (hits > 0) {
                drawsWithHits++;
                if (lastHit == null) {
                    lastHit = draw.date();
                }
                if (currentGap > 0) {
                    gaps.add(currentGap);
                }
                currentGap = 0;
            } else {
                currentGap++;
            }
        }
        if (currentGap > 0) {
            gaps.add(currentGap);
        }

        double hitFrequency = newestFirst.isEmpty() ? 0.0 : (double) drawsWithHits / newestFirst.size();
        double averageGap = gaps.stream().mapToInt(Integer::intValue).average().orElse(0.0);
        double gapVariance = gaps.size() > 1
                ? gaps.stream().mapToDouble(gap -> Math.pow(gap - averageGap, 2)).average().orElse(0.0)
                : 0.0;
        return new RangeMetrics(totalHits, hitFrequency, averageGap, streakOf(range, newestFirst),
                Optional.ofNullable(lastHit), statusOf(hitFrequency),
                daysSinceLastHit(lastHit, newestFirst), hitFrequency, gapVariance);
    }

    private static Streak streakOf(Range range, List<AnalyzedDraw> newestFirst) {
        boolean hot = !newestFirst.isEmpty() && newestFirst.get(0).hit(range);
        int draws = 0;
        for (AnalyzedDraw draw : newestFirst) {
            if (draw.hit(range) != hot) {
                break;
            }
            draws++;
        }
        return new Streak(hot, draws);
    }

    private static RangeStatus statusOf(double hitFrequency) {
        if (hitFrequency > BASELINE_HIT_FREQUENCY * HOT_FACTOR) {
            return RangeStatus.HOT;
        }
        if (hitFrequency < BASELINE_HIT_FREQUENCY * COLD_FACTOR) {
            return RangeStatus.COLD;
        }
        return RangeStatus.NORMAL;
    }

    /** The days from the last hit, or from the oldest draw when none hit, to the latest draw. */
    private static int daysSinceLastHit(LocalDate lastHit, List<AnalyzedDraw> newestFirst) {
        if (newestFirst.isEmpty()) {
            return 0;
        }
        LocalDate latest = newestFirst.get(0).date();
        LocalDate from = lastHit != null ? lastHit : newestFirst.get(newestFirst.size() - 1).date();
        return Math.max(0, (int) ChronoUnit.DAYS.between(from, latest));
    }
}
