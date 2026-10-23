package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Actionable recommendation for one pool segment (FR-011-B).
 *
 * <p>Priority is determined by the segment's accuracy ratio:
 * {@code "HIGH"} when {@code accuracyRatio >= 1.1}, {@code "MEDIUM"} when
 * {@code >= 0.97}, {@code "LOW"} otherwise.</p>
 *
 * <p>Confidence score is the proportion of segment numbers that are currently in
 * the HOT zone (games-out 0–9): {@code totalHotCount / segmentSize}, in the range
 * [0.0, 1.0].  The {@code topHotNumbers} field is capped at three entries for display;
 * the confidence denominator uses the full count of HOT numbers in the segment.
 * Returns {@code 0.0} when the segment is empty.</p>
 *
 * <p>Reasoning embeds runtime values in the format:<br>
 * {@code "Segment <label>: accuracy ratio <ratio> (<descriptor> expected), <n> hot numbers"}<br>
 * where descriptor is {@code "above"} (ratio &ge; 1.1), {@code "near"} (ratio &ge; 0.97),
 * or {@code "below"} (otherwise), and {@code <n>} is the full count of HOT numbers.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param priority        priority classification: {@code "HIGH"}, {@code "MEDIUM"},
 *                        or {@code "LOW"}
 * @param confidenceScore proportion of segment numbers in the HOT zone (gamesOut 0–9),
 *                        in [0.0, 1.0]; {@code 0.0} when segment is empty
 * @param topHotNumbers   up to the first three numbers in the segment with
 *                        games-out &le; 9, sorted ascending
 * @param reasoning       human-readable string embedding the segment label, accuracy
 *                        ratio, descriptor, and hot-number count
 */
public record SegmentRecommendationViewModel(
        String priority,
        double confidenceScore,
        List<Integer> topHotNumbers,
        String reasoning
) {}
