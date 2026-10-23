package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.PatternEdgeViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Pure walk-forward pattern edge detector assembler (FR-015).
 *
 * <p>Answers the question: do decade-bucket fingerprints have a statistically significant
 * out-of-sample predictive edge? For a fair, independent lottery the correct and expected
 * result is always "No edge". The assembler is rigorous enough to confirm that honest null
 * result, and sensitive enough to detect a real edge when one exists in a synthetic dataset.</p>
 *
 * <p><strong>Algorithm overview:</strong></p>
 * <ol>
 *   <li>Walk forward through the history starting at index {@code warmupDraws}.</li>
 *   <li>For each tested draw D at index {@code i}: build the top-N predicted fingerprint set
 *       from draws {@code [0, i)} <em>exclusively</em> - draw D is NEVER included in the
 *       window used to predict itself (strict out-of-sample correctness).</li>
 *   <li>Count hits (actual fingerprint of D is in the predicted set).</li>
 *   <li>Derive pool and pick from the <em>last</em> draw in {@code patterns}; these are
 *       game-level constants that do not change draw to draw (mirrors
 *       {@code DashboardService.deriveFieldMax} / {@code deriveGameNumberCount}).</li>
 *   <li>Compute the combinatorial chance baseline via the hypergeometric formula:
 *       {@code P(fp) = Π_i C(bucketSize_i, fp_count_i) / C(pool, pick)}.</li>
 *   <li>Compute the Poisson-binomial normal approximation (z-score and two-sided p-value)
 *       using the Abramowitz & Stegun rational CDF approximation (A&S 26.2.17,
 *       max error 7.5×10⁻⁸) - no external statistics library required.</li>
 *   <li>Return {@link PatternEdgeViewModel}; never {@code null} (Effective Java Item 54).</li>
 * </ol>
 *
 * <p><strong>Binomial coefficient precision note:</strong> this assembler computes binomial
 * coefficients as {@code double} values via the multiplicative formula
 * {@code C(n,k) = Π_{i=0}^{k-1} (n-i)/(i+1)}. For the lottery parameters encountered in
 * this codebase (pool ≤ 69, pick ≤ 6, e.g. C(35,5)=324,632; C(69,5)=11,238,513) the
 * double representation is exact - all values are well within the integer precision range of
 * {@code double} (exact integers up to 2⁵³ ≈ 9×10¹⁵). Using {@code double} from the start
 * is defensive and consistent with the downstream probability computation.</p>
 *
 * <p>This class is {@code final} and stateless; thread-safety is trivially guaranteed -
 * all state is confined to local variables within each method invocation
 * (Effective Java Items 17, 82). It is a Spring {@code @Component} and is wired by
 * {@link com.floyd.lottoptions.bff.service.PatternEdgeService} via constructor injection.</p>
 *
 * <p>No I/O, no reactive types, no {@code Math.random()} anywhere in this class.</p>
 */
@Component
public final class PatternEdgeAssembler {

    private static final Logger log = LoggerFactory.getLogger(PatternEdgeAssembler.class);

    /** Default top-N fingerprints to include in the predicted set (FR-015 Section 1.1). */
    public static final int DEFAULT_TOP_N = 5;

    /** Default number of warm-up draws before the walk-forward test begins (FR-015 Section 1.1). */
    public static final int DEFAULT_WARMUP_DRAWS = 50;

    /** P-value threshold below which a result is considered statistically significant (FR-015). */
    public static final double SIGNIFICANCE_THRESHOLD = 0.05;

    /** Bucket size for decade partitioning (must match {@link DrawFingerprintUtil}). */
    private static final int BUCKET_SIZE = 10;

    /**
     * Builds the walk-forward pattern edge view model.
     *
     * <p>Pool and pick are derived from the last draw in {@code patterns} - these are
     * game-level constants that do not change draw to draw. Guards:
     * <ul>
     *   <li>{@code patterns == null} → {@link NullPointerException} (Item 49).</li>
     *   <li>{@code patterns.isEmpty()}, {@code patterns.size() <= warmupDraws}, pool &le; 0,
     *       pick &le; 0, {@code C(pool,pick) <= 0}, or {@code variance <= 0} →
     *       returns the insufficient-data sentinel (Item 54).</li>
     * </ul>
     *
     * @param patterns    ordered (oldest-first) draw history; must not be {@code null}
     * @param topN        top-N fingerprints to include in the predicted set; must be &ge; 1
     * @param warmupDraws number of draws to use as warm-up; tested draws start at this index
     * @return walk-forward edge result; never {@code null}
     */
    public PatternEdgeViewModel buildPatternEdge(
            List<DrawResultPattern> patterns, int topN, int warmupDraws) {
        Objects.requireNonNull(patterns, "patterns must not be null");

        int tested = patterns.size() - warmupDraws;
        if (patterns.isEmpty() || tested <= 0) {
            return insufficientData(0, topN, warmupDraws);
        }

        // Derive pool and pick from the last draw (game-level constants - do not vary per draw)
        DrawResultPattern lastDraw = patterns.get(patterns.size() - 1);
        int pool = derivePool(lastDraw);
        int pick = derivePick(lastDraw);

        if (pool <= 0 || pick <= 0) {
            return insufficientData(tested, topN, warmupDraws);
        }

        double denominator = binomCoeff(pool, pick);
        if (denominator <= 0.0) {
            return insufficientData(tested, topN, warmupDraws);
        }

        // Walk-forward: for each tested draw D at index i (i >= warmupDraws)
        // predictedSet is built from draws [0, i) - draw D is NEVER in its own window
        int hits = 0;
        double expectedHits = 0.0;
        double variance = 0.0;

        // Frequency map maintained as an expanding window
        Map<String, Integer> freqMap = new HashMap<>();

        // Pre-populate frequency map with warmup draws
        for (int i = 0; i < warmupDraws; i++) {
            String fp = DrawFingerprintUtil.computeFingerprint(patterns.get(i));
            if (!fp.isEmpty()) {
                freqMap.merge(fp, 1, Integer::sum);
            }
        }

        for (int i = warmupDraws; i < patterns.size(); i++) {
            // predictedSet is top-N over freqMap at this point (draws [0, i) only)
            List<String> predictedSet = topNFingerprints(freqMap, topN);

            // Fingerprint the current draw D
            String fp = DrawFingerprintUtil.computeFingerprint(patterns.get(i));

            if (!fp.isEmpty() && predictedSet.contains(fp)) {
                hits++;
            }

            // Compute p_D = sum of P(fp) for each fp in predictedSet
            double pD = 0.0;
            for (String predicted : predictedSet) {
                pD += fingerprintProbability(predicted, pool, pick, denominator);
            }

            expectedHits += pD;
            variance += pD * (1.0 - pD);

            // Update frequency map with draw D (AFTER computing predictedSet - strict past-only)
            if (!fp.isEmpty()) {
                freqMap.merge(fp, 1, Integer::sum);
            }
        }

        if (variance <= 0.0) {
            return insufficientData(tested, topN, warmupDraws);
        }

        double observedHitRate = (double) hits / tested;
        double chanceHitRate = expectedHits / tested;
        double edgePoints = (observedHitRate - chanceHitRate) * 100.0;
        double zScore = (hits - expectedHits) / Math.sqrt(variance);
        double pValue = 2.0 * (1.0 - standardNormalCdf(Math.abs(zScore)));
        boolean isSignificant = (pValue < SIGNIFICANCE_THRESHOLD) && (edgePoints > 0.0);

        String verdict;
        if (isSignificant) {
            verdict = String.format("Edge +%.1f pts (p=%.4f)", edgePoints, pValue);
        } else {
            verdict = "No edge - patterns don't beat chance";
        }

        return new PatternEdgeViewModel(
                observedHitRate, chanceHitRate, edgePoints, zScore, pValue,
                isSignificant, verdict, tested, topN, warmupDraws);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Returns the top-N fingerprints from the frequency map by frequency descending,
     * then lexicographic ascending as a stable tie-break (deterministic for planted-edge tests).
     *
     * @param freqMap current frequency counts (past-only window)
     * @param topN    maximum number of fingerprints to return
     * @return ordered list of at most {@code topN} fingerprint strings
     */
    private List<String> topNFingerprints(Map<String, Integer> freqMap, int topN) {
        return freqMap.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder())
                        .thenComparing(Map.Entry.comparingByKey()))
                .limit(topN)
                .map(Map.Entry::getKey)
                .toList();
    }

    /**
     * Computes P(fp) = probability that a single uniformly random draw of {@code pick}
     * numbers from a pool of {@code pool} numbers produces fingerprint {@code fp}.
     *
     * <p>Formula: {@code Π_i C(bucketSize_i, fp_count_i) / C(pool, pick)}.</p>
     *
     * <p>Bucket sizes are derived from {@code pool}: bucket 0 covers 1–9 (size = min(9, pool));
     * bucket k covers k*10..(k*10+9) with size 10, except the last bucket which covers
     * the remainder. Equivalently: size = count of integers n in [1..pool] with n/10 == k.</p>
     *
     * <p>A malformed or unparseable fingerprint returns {@code P=0.0} with a logged warning
     * (does not throw).</p>
     *
     * @param fp          fingerprint string (e.g. "1-2-1-1")
     * @param pool        number of balls in the lottery pool
     * @param pick        number of balls drawn per game
     * @param denominator precomputed {@code C(pool, pick)}; must be > 0
     * @return probability in [0, 1], or 0.0 for malformed input
     */
    private double fingerprintProbability(String fp, int pool, int pick, double denominator) {
        int[] counts = parseFingerprintCounts(fp, pool, pick);
        if (counts == null) {
            return 0.0;
        }

        int bucketCount = (pool / BUCKET_SIZE) + 1;
        double numerator = 1.0;

        for (int k = 0; k < bucketCount; k++) {
            int bucketSize = bucketSizeForIndex(k, pool);
            double c = binomCoeff(bucketSize, counts[k]);
            numerator *= c;
        }

        return numerator / denominator;
    }

    /**
     * Parses the fingerprint string into bucket counts array.
     *
     * <p>Validates that: the part count matches {@code (pool/BUCKET_SIZE)+1}, each part
     * is a non-negative integer, and the sum equals {@code pick}.
     * Returns {@code null} for any invalid fingerprint (does not throw).</p>
     *
     * @param fp   the fingerprint string (e.g. "1-2-1-1")
     * @param pool lottery pool size
     * @param pick number of winners per draw
     * @return array of per-bucket counts, or {@code null} if malformed
     */
    private int[] parseFingerprintCounts(String fp, int pool, int pick) {
        if (fp == null || fp.isEmpty()) {
            return null;
        }
        String[] parts = fp.split("-");
        int bucketCount = (pool / BUCKET_SIZE) + 1;
        if (parts.length != bucketCount) {
            log.warn("Fingerprint '{}' has {} parts; expected {} for pool={}",
                    fp, parts.length, bucketCount, pool);
            return null;
        }
        int[] counts = new int[bucketCount];
        int sum = 0;
        for (int i = 0; i < bucketCount; i++) {
            try {
                counts[i] = Integer.parseInt(parts[i]);
            } catch (NumberFormatException e) {
                log.warn("Fingerprint '{}' contains non-integer part at index {}", fp, i);
                return null;
            }
            if (counts[i] < 0) {
                log.warn("Fingerprint '{}' contains negative count at index {}", fp, i);
                return null;
            }
            sum += counts[i];
        }
        if (sum != pick) {
            log.warn("Fingerprint '{}' parts sum to {}; expected pick={}", fp, sum, pick);
            return null;
        }
        return counts;
    }

    /**
     * Returns the size of decade bucket {@code k} for the given pool.
     *
     * <p>Bucket 0 covers numbers 1–9 (size = min(9, pool)); bucket k covers
     * [k*10 .. k*10+9] but capped at pool. Equivalently: the count of integers n
     * in [1..pool] with {@code n/10 == k}.</p>
     *
     * @param k    bucket index (0-based)
     * @param pool number of balls in the lottery pool
     * @return the number of balls in bucket {@code k}
     */
    private int bucketSizeForIndex(int k, int pool) {
        int low = (k == 0) ? 1 : k * BUCKET_SIZE;
        int high = Math.min(k * BUCKET_SIZE + BUCKET_SIZE - 1, pool);
        // Bucket 0 covers 1–9 (low=1, high=min(9,pool)); bucket k>=1 covers k*10..(k*10+9)
        // Adjust: for k>=1, low = k*10, high = min(k*10+9, pool)
        if (k >= 1) {
            low = k * BUCKET_SIZE;
            high = Math.min(k * BUCKET_SIZE + (BUCKET_SIZE - 1), pool);
        }
        return Math.max(0, high - low + 1);
    }

    /**
     * Computes the binomial coefficient C(n, k) using the multiplicative formula.
     *
     * <p>The formula {@code C(n,k) = Π_{i=0}^{k-1} (n-i)/(i+1)} is computed as a
     * {@code double} ratio. Uses the smaller of {@code k} and {@code n-k} for efficiency.
     * For the lottery parameters in this codebase (pool ≤ 69, pick ≤ 6), all values
     * fit exactly as doubles (well within 2⁵³ ≈ 9×10¹⁵).</p>
     *
     * @param n total items
     * @param k items to choose
     * @return {@code C(n, k)}, or {@code 0.0} for invalid inputs ({@code k < 0} or {@code k > n})
     */
    static double binomCoeff(int n, int k) {
        if (k < 0 || k > n) return 0.0;
        if (k == 0 || k == n) return 1.0;
        k = Math.min(k, n - k); // use smaller k for efficiency
        double result = 1.0;
        for (int i = 0; i < k; i++) {
            result *= (double) (n - i) / (i + 1);
        }
        return result;
    }

    /**
     * Computes the standard normal CDF Φ(x) using the Abramowitz & Stegun rational
     * approximation (A&S 26.2.17, max error 7.5×10⁻⁸).
     *
     * <p>Adequate precision for a p-value threshold of 0.05. No external statistics
     * dependency required (FR-015 Section 1.2 constraint G).</p>
     *
     * @param x the argument
     * @return Φ(x) in (0, 1)
     */
    private static double standardNormalCdf(double x) {
        // A&S 26.2.17 rational approximation
        // p1(t) = 1 − φ(x) * (b1*t + b2*t² + b3*t³ + b4*t⁴ + b5*t⁵)
        // where t = 1/(1 + 0.2316419*|x|), φ(x) = standard normal PDF
        final double b1 =  0.319381530;
        final double b2 = -0.356563782;
        final double b3 =  1.781477937;
        final double b4 = -1.821255978;
        final double b5 =  1.330274429;
        final double p  =  0.2316419;

        double absX = Math.abs(x);
        double t = 1.0 / (1.0 + p * absX);
        double pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
        double poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
        double cdfPositive = 1.0 - pdf * poly;

        return x >= 0.0 ? cdfPositive : 1.0 - cdfPositive;
    }

    /**
     * Derives the pool (maximum ball number) from the given draw.
     *
     * @param draw the draw to inspect
     * @return the maximum ball number, or 0 if the draw has no numbers
     */
    private int derivePool(DrawResultPattern draw) {
        if (draw == null || draw.lotteryNumbers() == null || draw.lotteryNumbers().isEmpty()) {
            return 0;
        }
        return draw.lotteryNumbers().stream()
                .mapToInt(LotteryNumber::number)
                .max()
                .orElse(0);
    }

    /**
     * Derives the pick count (number of winners with gamesOut == 0) from the given draw.
     *
     * @param draw the draw to inspect
     * @return the count of winning numbers, or 0 if the draw has no winners
     */
    private int derivePick(DrawResultPattern draw) {
        if (draw == null || draw.lotteryNumbers() == null) {
            return 0;
        }
        return (int) draw.lotteryNumbers().stream()
                .filter(ln -> ln.gamesOut() == 0)
                .count();
    }

    /**
     * Returns the insufficient-data sentinel view model (Effective Java Item 54).
     *
     * <p>pValue is set to 1.0 (no significance) and verdict to "Insufficient data".</p>
     *
     * @param testedDraws number of draws that were tested (may be 0)
     * @param topN        top-N parameter
     * @param warmupDraws warmup-draws parameter
     * @return a zeroed sentinel view model; never {@code null}
     */
    private PatternEdgeViewModel insufficientData(int testedDraws, int topN, int warmupDraws) {
        return new PatternEdgeViewModel(
                0.0, 0.0, 0.0, 0.0, 1.0, false,
                "Insufficient data", testedDraws, topN, warmupDraws);
    }
}
