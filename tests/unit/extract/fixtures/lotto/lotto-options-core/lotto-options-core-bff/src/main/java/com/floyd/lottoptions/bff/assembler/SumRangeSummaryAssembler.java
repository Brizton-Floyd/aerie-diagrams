package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.PatternSummaryEntryViewModel;
import com.floyd.lottoptions.bff.viewmodel.SumRangeSummaryViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Pure assembler that derives the Sum-Range distribution panel (FR-011-A) from
 * the full draw history.
 *
 * <p>For every draw the drawn numbers are summed; sums are bucketed into
 * ranges of 10.  Per bucket the assembler computes:</p>
 * <ul>
 *   <li>{@code frequency} - count of draws whose sum falls in the bucket</li>
 *   <li>{@code probability} - normal-approximation CDF: {@code P(sum ∈ bucket)}</li>
 *   <li>{@code estimatedHitFrequency} - {@code probability * totalDraws} (3 d.p.)</li>
 *   <li>{@code gamesSinceLastAppearance} - draws since the most-recent draw in
 *       the bucket</li>
 * </ul>
 *
 * <p>Pool ({@code pool = max ball number}) and pick
 * ({@code pick = count of balls drawn per draw where gamesOut == 0}) are derived
 * from the most-recent {@code DrawResultPattern} - they are never hardcoded.</p>
 *
 * <p>Normal-approximation parameters:</p>
 * <pre>
 *   mu    = pick * (pool + 1) / 2
 *   var   = pick * ((pool^2 - 1) / 12.0) * ((pool - pick) / (double)(pool - 1))
 *   sigma = sqrt(var)
 *   P(bucket) = normalCdf((bucketHigh + 0.5 - mu) / sigma)
 *             - normalCdf((bucketLow  - 0.5 - mu) / sigma)
 * </pre>
 *
 * <p>Guard conditions:</p>
 * <ul>
 *   <li>Null or empty input → {@code List.of()} (Effective Java Item 54).</li>
 *   <li>{@code pick == 0} or {@code pool &lt;= 1} → {@code List.of()}
 *       (sigma would be zero).</li>
 * </ul>
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). No I/O, no reactive
 * types.  No {@code Math.random()} anywhere (ADR-0003).</p>
 */
@Component
public final class SumRangeSummaryAssembler {

    /** Bucket width for sum-range grouping (matches desktop rangeSize=10 convention). */
    static final int BUCKET_SIZE = 10;

    /**
     * Builds the sum-range summary from the full draw history.
     *
     * @param allPatterns the complete draw history (oldest to newest); may be {@code null}
     * @return sum-range summary sorted by probability descending;
     *         {@link SumRangeSummaryViewModel} with {@code List.of()} patterns when
     *         input is null, empty, or the pool/pick cannot be derived
     */
    public SumRangeSummaryViewModel buildSumRangeSummary(List<DrawResultPattern> allPatterns) {
        if (allPatterns == null || allPatterns.isEmpty()) {
            return new SumRangeSummaryViewModel(List.of());
        }

        DrawResultPattern latest = allPatterns.get(allPatterns.size() - 1);
        List<LotteryNumber> latestNumbers = latest.lotteryNumbers();
        if (latestNumbers == null || latestNumbers.isEmpty()) {
            return new SumRangeSummaryViewModel(List.of());
        }

        int pool = latestNumbers.stream()
                .mapToInt(LotteryNumber::number)
                .max()
                .orElse(0);
        int pick = (int) latestNumbers.stream()
                .filter(ln -> ln.gamesOut() == 0)
                .count();

        // Guard: cannot compute normal approximation without valid pool/pick
        if (pick <= 0 || pool <= 1) {
            return new SumRangeSummaryViewModel(List.of());
        }

        // Variance formula:  pick * ((pool^2 - 1) / 12) * ((pool - pick) / (pool - 1))
        double mu = pick * (pool + 1) / 2.0;
        double var = pick
                * ((double)(pool * pool - 1) / 12.0)
                * ((double)(pool - pick) / (double)(pool - 1));

        // Guard: if variance is non-positive (degenerate case), return empty
        if (var <= 0) {
            return new SumRangeSummaryViewModel(List.of());
        }
        double sigma = Math.sqrt(var);

        // Compute sum per draw and determine observed min/max sum
        int totalDraws = allPatterns.size();
        int[] drawSums = new int[totalDraws];
        int observedMin = Integer.MAX_VALUE;
        int observedMax = Integer.MIN_VALUE;
        for (int i = 0; i < totalDraws; i++) {
            DrawResultPattern pattern = allPatterns.get(i);
            List<LotteryNumber> numbers = pattern.lotteryNumbers();
            if (numbers == null) {
                drawSums[i] = 0;
                continue;
            }
            // Sum ONLY the drawn numbers (gamesOut == 0). Each DrawResultPattern carries
            // the full field (every ball, drawn or not); summing all of them would yield a
            // constant (1+2+…+pool) every draw. Mirror the pick-derivation filter above.
            int sum = numbers.stream()
                    .filter(ln -> ln.gamesOut() == 0)
                    .mapToInt(LotteryNumber::number)
                    .sum();
            drawSums[i] = sum;
            if (sum < observedMin) observedMin = sum;
            if (sum > observedMax) observedMax = sum;
        }

        if (observedMin == Integer.MAX_VALUE) {
            return new SumRangeSummaryViewModel(List.of());
        }

        // Build buckets: align to BUCKET_SIZE boundaries starting at observedMin
        int firstBucketLo = (observedMin / BUCKET_SIZE) * BUCKET_SIZE;
        List<int[]> buckets = new ArrayList<>(); // [bucketLo, bucketHi]
        for (int lo = firstBucketLo; lo <= observedMax; lo += BUCKET_SIZE) {
            buckets.add(new int[]{lo, lo + BUCKET_SIZE - 1});
        }

        // Per bucket: count frequency and track lastAppearance index
        int numBuckets = buckets.size();
        int[] frequency = new int[numBuckets];
        int[] lastAppearanceIdx = new int[numBuckets];
        for (int b = 0; b < numBuckets; b++) {
            lastAppearanceIdx[b] = -1;
        }

        for (int d = 0; d < totalDraws; d++) {
            int sum = drawSums[d];
            for (int b = 0; b < numBuckets; b++) {
                if (sum >= buckets.get(b)[0] && sum <= buckets.get(b)[1]) {
                    frequency[b]++;
                    lastAppearanceIdx[b] = d;
                    break;
                }
            }
        }

        // Build PatternSummaryEntryViewModel per bucket
        List<PatternSummaryEntryViewModel> entries = new ArrayList<>(numBuckets);
        for (int b = 0; b < numBuckets; b++) {
            int lo = buckets.get(b)[0];
            int hi = buckets.get(b)[1];
            String label = lo + "–" + hi;

            // Normal approximation with continuity correction
            double probHi = normalCdf((hi + 0.5 - mu) / sigma);
            double probLo = normalCdf((lo - 0.5 - mu) / sigma);
            double probability = Math.max(0.0, probHi - probLo);

            double estimatedHitFrequency = round3(probability * totalDraws);

            int gamesSinceLastAppearance = lastAppearanceIdx[b] < 0
                    ? 0
                    : (totalDraws - 1 - lastAppearanceIdx[b]);

            entries.add(new PatternSummaryEntryViewModel(
                    label,
                    frequency[b],
                    probability,
                    estimatedHitFrequency,
                    gamesSinceLastAppearance));
        }

        // Sort by probability descending
        entries.sort(Comparator.comparingDouble(PatternSummaryEntryViewModel::probability).reversed());

        return new SumRangeSummaryViewModel(List.copyOf(entries));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Approximates the standard normal CDF using the Horner-form rational
     * approximation from Abramowitz &amp; Stegun (7.1.26), maximum error &lt; 7.5e-8.
     *
     * @param z the standard-normal deviate
     * @return {@code P(Z &lt;= z)} in [0, 1]
     */
    static double normalCdf(double z) {
        // Handle extreme values to avoid overflow
        if (z < -8.0) return 0.0;
        if (z >  8.0) return 1.0;

        double t = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
        double poly = t * (0.319381530
                + t * (-0.356563782
                + t * (1.781477937
                + t * (-1.821255978
                + t *  1.330274429))));
        double pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2.0 * Math.PI);
        double cdf = 1.0 - pdf * poly;
        return z >= 0 ? cdf : 1.0 - cdf;
    }

    /**
     * Rounds {@code value} to three decimal places.
     *
     * @param value the value to round
     * @return value rounded to 3 d.p.
     */
    private static double round3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }
}
