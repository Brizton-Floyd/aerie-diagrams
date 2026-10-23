package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.SegmentEntryViewModel;
import com.floyd.lottoptions.bff.viewmodel.SegmentNumberDetailViewModel;
import com.floyd.lottoptions.bff.viewmodel.SegmentRecommendationViewModel;
import com.floyd.lottoptions.bff.viewmodel.SegmentsSummaryViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure assembler that derives the Segments heat-map panel (FR-011-B, rework) from the
 * full draw history.
 *
 * <p>The pool is split into decade segments using integer division:
 * {@code segmentIndex = n / SEGMENT_SIZE}. Segment 0 holds numbers 1–9 (9 numbers);
 * segment 1 holds 10–19; segment 2 holds 20–29; etc. The last segment is clamped to
 * the actual pool maximum. Segment count = {@code (pool / SEGMENT_SIZE) + 1}.
 * Range labels use a plain hyphen: "1-9", "10-19", "20-29", "30-35", etc.</p>
 *
 * <p>Per segment the assembler computes:</p>
 * <ul>
 *   <li>{@code avgGamesOut} - mean current games-out across segment numbers</li>
 *   <li>{@code actualHits} - total appearances (games-out == 0) across history</li>
 *   <li>{@code expectedHits} - {@code (segmentSize / pool) * pick * totalDraws}</li>
 *   <li>{@code accuracyRatio} - {@code actualHits / expectedHits}</li>
 *   <li>{@code recommendation} - priority / confidence / hotNumbers / reasoning</li>
 * </ul>
 *
 * <p>Pool ({@code pool = max ball number}) and pick
 * ({@code pick = count of balls with gamesOut == 0 in the most-recent draw}) are
 * derived at runtime - they are never hardcoded.</p>
 *
 * <p>Zone classification delegates to
 * {@link FrequencyRollupAssembler#classifyZone(int)} (same package, package-private
 * static method - no duplication, no visibility change).</p>
 *
 * <p>Guard conditions:</p>
 * <ul>
 *   <li>Null or empty input → {@link SegmentsSummaryViewModel} with {@code List.of()}
 *       (Effective Java Item 54).</li>
 *   <li>{@code expectedHits == 0} → {@code accuracyRatio = 0.0} (division-by-zero
 *       guard).</li>
 * </ul>
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). No I/O, no reactive
 * types.  No {@code Math.random()} (ADR-0003).</p>
 */
@Component
public final class SegmentsSummaryAssembler {

    /** Segment width - matches desktop rangeSize=10 convention. */
    static final int SEGMENT_SIZE = 10;

    /**
     * Builds the segments summary from the full draw history.
     *
     * @param allPatterns the complete draw history (oldest to newest); may be {@code null}
     * @return segments summary ordered by ascending range label;
     *         {@link SegmentsSummaryViewModel} with {@code List.of()} when input is
     *         null, empty, or pool/pick cannot be derived
     */
    public SegmentsSummaryViewModel buildSegmentsSummary(List<DrawResultPattern> allPatterns) {
        if (allPatterns == null || allPatterns.isEmpty()) {
            return new SegmentsSummaryViewModel(List.of());
        }

        DrawResultPattern latest = allPatterns.get(allPatterns.size() - 1);
        List<LotteryNumber> latestNumbers = latest.lotteryNumbers();
        if (latestNumbers == null || latestNumbers.isEmpty()) {
            return new SegmentsSummaryViewModel(List.of());
        }

        int pool = latestNumbers.stream()
                .mapToInt(LotteryNumber::number)
                .max()
                .orElse(0);
        int pick = (int) latestNumbers.stream()
                .filter(ln -> ln.gamesOut() == 0)
                .count();

        if (pool <= 0) {
            return new SegmentsSummaryViewModel(List.of());
        }

        int totalDraws = allPatterns.size();

        // Build current GO map: number → currentGamesOut (from latest draw)
        Map<Integer, Integer> currentGoMap = new HashMap<>();
        for (LotteryNumber ln : latestNumbers) {
            currentGoMap.put(ln.number(), ln.gamesOut());
        }

        // Build hit count map: number → total hit appearances across all draws
        Map<Integer, Integer> hitCountMap = new HashMap<>();
        for (int num : currentGoMap.keySet()) {
            hitCountMap.put(num, 0);
        }
        for (DrawResultPattern pattern : allPatterns) {
            List<LotteryNumber> numbers = pattern.lotteryNumbers();
            if (numbers == null) continue;
            for (LotteryNumber ln : numbers) {
                if (ln.gamesOut() == 0 && hitCountMap.containsKey(ln.number())) {
                    hitCountMap.merge(ln.number(), 1, Integer::sum);
                }
            }
        }

        // Decade bucketing: segmentIndex = n / SEGMENT_SIZE; segmentCount = (pool/SEGMENT_SIZE)+1
        // Segment 0 → numbers where n/SEGMENT_SIZE == 0, i.e., 1..9 (size 9)
        // Segment b → numbers where n/SEGMENT_SIZE == b, i.e., b*10..min(b*10+9, pool)
        // Label: b==0 → "1-9"; b>=1 → b*10 + "-" + min(b*10+9, pool)
        int numSegments = (pool / SEGMENT_SIZE) + 1;
        List<SegmentEntryViewModel> segments = new ArrayList<>(numSegments);

        for (int b = 0; b < numSegments; b++) {
            int segStart = (b == 0) ? 1 : b * SEGMENT_SIZE;
            int segEnd   = Math.min(b * SEGMENT_SIZE + SEGMENT_SIZE - 1, pool);
            String rangeLabel = (b == 0) ? "1-9" : (b * SEGMENT_SIZE) + "-" + segEnd;

            // Collect numbers in this segment: all n where n/SEGMENT_SIZE == b
            List<SegmentNumberDetailViewModel> numberDetails = new ArrayList<>();
            for (int num = segStart; num <= segEnd; num++) {
                Integer go = currentGoMap.get(num);
                if (go == null) continue; // number not in field (sparse pool edge case)
                String zone = FrequencyRollupAssembler.classifyZone(go);
                numberDetails.add(new SegmentNumberDetailViewModel(num, go, zone));
            }

            if (numberDetails.isEmpty()) {
                continue; // skip empty segment (e.g. pool doesn't include these numbers)
            }

            int segmentSize = numberDetails.size();

            // avgGamesOut: guard division-by-zero (segmentSize > 0 here)
            double sumGo = numberDetails.stream().mapToInt(SegmentNumberDetailViewModel::gamesOut).sum();
            double avgGamesOut = sumGo / segmentSize;

            // actualHits: sum of hitCounts for numbers in this segment
            int actualHits = numberDetails.stream()
                    .mapToInt(d -> hitCountMap.getOrDefault(d.number(), 0))
                    .sum();

            // expectedHits: (segmentSize / pool) * pick * totalDraws
            double expectedHits = ((double) segmentSize / pool) * pick * totalDraws;

            // accuracyRatio: division-by-zero guard
            double accuracyRatio = (expectedHits == 0.0) ? 0.0 : (actualHits / expectedHits);

            // Hot numbers in segment (zone == HOT), sorted ascending, limit 3 for display
            long totalHotCount = numberDetails.stream()
                    .filter(d -> "HOT".equals(d.heatZone()))
                    .count();
            List<Integer> topHotNumbers = numberDetails.stream()
                    .filter(d -> "HOT".equals(d.heatZone()))
                    .map(SegmentNumberDetailViewModel::number)
                    .sorted()
                    .limit(3)
                    .toList();

            SegmentRecommendationViewModel recommendation =
                    buildRecommendation(rangeLabel, accuracyRatio, topHotNumbers,
                            segmentSize, (int) totalHotCount);

            segments.add(new SegmentEntryViewModel(
                    rangeLabel,
                    List.copyOf(numberDetails),
                    avgGamesOut,
                    actualHits,
                    expectedHits,
                    accuracyRatio,
                    recommendation));
        }

        return new SegmentsSummaryViewModel(List.copyOf(segments));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Builds the recommendation for a segment based on its accuracy ratio and zone
     * distribution.
     *
     * <p>Priority thresholds:</p>
     * <ul>
     *   <li>{@code HIGH}   - {@code accuracyRatio >= 1.1}</li>
     *   <li>{@code MEDIUM} - {@code accuracyRatio >= 0.97}</li>
     *   <li>{@code LOW}    - otherwise</li>
     * </ul>
     *
     * <p>Confidence is the proportion of segment numbers that are currently HOT
     * (games-out 0–9): {@code totalHotCount / segmentSize}.  The {@code topHotNumbers}
     * list is capped at 3 for display, so {@code totalHotCount} is supplied separately
     * as the true numerator.  Returns {@code 0.0} when {@code segmentSize == 0}
     * (division-by-zero guard).</p>
     *
     * @param rangeLabel     the segment label (e.g. {@code "1-9"}, {@code "10-19"})
     * @param accuracyRatio  the computed accuracy ratio for the segment
     * @param topHotNumbers  up to 3 hot numbers in the segment (gamesOut &le; 9), for display
     * @param segmentSize    total number of numbers in the segment (must be &ge; 0)
     * @param totalHotCount  full count of HOT numbers in the segment (may exceed 3)
     * @return the recommendation for the segment
     */
    private SegmentRecommendationViewModel buildRecommendation(
            String rangeLabel, double accuracyRatio, List<Integer> topHotNumbers,
            int segmentSize, int totalHotCount) {

        String priority;
        String descriptor;
        if (accuracyRatio >= 1.1) {
            priority   = "HIGH";
            descriptor = "above";
        } else if (accuracyRatio >= 0.97) {
            priority   = "MEDIUM";
            descriptor = "near";
        } else {
            priority   = "LOW";
            descriptor = "below";
        }

        String reasoning = String.format(
                "Segment %s: accuracy ratio %.2f (%s expected), %d hot numbers",
                rangeLabel, accuracyRatio, descriptor, totalHotCount);

        // confidenceScore = proportion of segment numbers that are HOT (gamesOut 0–9)
        // Uses totalHotCount (the full count) so numbers beyond the display cap of 3 are included.
        // Division-by-zero guard: segmentSize == 0 → 0.0
        double confidenceScore = (segmentSize == 0) ? 0.0
                : (double) totalHotCount / segmentSize;

        return new SegmentRecommendationViewModel(priority, confidenceScore, topHotNumbers, reasoning);
    }
}
