package com.floyd.lottoptions.core.domain.range;

import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;

/**
 * How one range performed over the analyzed draws.
 *
 * @param totalHits           the numbers that fell in the range, over all draws
 * @param hitFrequency        the share of draws that hit the range
 * @param averageGap          the average length of the runs of draws that missed the range;
 *                            {@code 0} when every draw hit it
 * @param streak              the current streak
 * @param lastHit             the date of the latest draw that hit the range; empty when none did
 * @param status              how often the range hits against the baseline
 * @param daysSinceLastHit    the days from the last hit to the latest draw; the days from the
 *                            oldest to the latest draw when no draw hit the range
 * @param expectedProbability the expected chance a draw hits the range: its hit frequency
 * @param gapVariance         the population variance of those runs' lengths; {@code 0} with
 *                            fewer than two runs
 */
public record RangeMetrics(int totalHits, double hitFrequency, double averageGap, Streak streak,
                           Optional<LocalDate> lastHit, RangeStatus status, int daysSinceLastHit,
                           double expectedProbability, double gapVariance) {

    public RangeMetrics {
        Objects.requireNonNull(streak, "streak");
        Objects.requireNonNull(lastHit, "lastHit");
        Objects.requireNonNull(status, "status");
    }
}
