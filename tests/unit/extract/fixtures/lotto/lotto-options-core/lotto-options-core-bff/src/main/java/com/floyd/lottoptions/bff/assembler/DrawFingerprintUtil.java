package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;

import java.util.Arrays;
import java.util.List;

/**
 * Package-private utility that computes the decade-bucket fingerprint string for a
 * single lottery draw.
 *
 * <p>Algorithm (FR-012, decade bucketing):
 * <ol>
 *   <li>Derive {@code pool} = max number across all numbers in the draw.</li>
 *   <li>Compute {@code bucketCount = (pool / BUCKET_SIZE) + 1}.</li>
 *   <li>For each winning number (gamesOut == 0), increment
 *       {@code counts[number / BUCKET_SIZE]}.</li>
 *   <li>Return the counts joined with "-".</li>
 * </ol>
 * Decade placement: bucket 0 holds numbers 1–9, bucket 1 holds 10–19,
 * bucket 2 holds 20–29, etc. The bucket index for number {@code n} is
 * {@code n / BUCKET_SIZE} (integer division). Bucket count is
 * {@code (pool / BUCKET_SIZE) + 1} so that the bucket containing {@code pool}
 * is always included. The resulting string's parts sum to the draw's pick count.</p>
 *
 * <p>Example: winners {3, 12, 15, 28, 33} with pool 35 → bucketCount 4 →
 * 3→b0, 12→b1, 15→b1, 28→b2, 33→b3 → "1-2-1-1".</p>
 *
 * <p>Boundary example: winners {5, 10, 20, 30, 35} with pool 35 →
 * 5→b0, 10→b1, 20→b2, 30→b3, 35→b3 → counts [1,1,1,2] → "1-1-1-2".</p>
 *
 * <p>Guards: returns {@code ""} when lotteryNumbers is null/empty, pool &le; 0,
 * or no winners exist in the draw (Effective Java Item 54).</p>
 *
 * <p>This class is a non-instantiable utility (Effective Java Item 4). It is
 * {@code final} (Effective Java Items 17, 19) and package-private. The single
 * static method is accessible within the {@code assembler} package without
 * exposing it to the public API.</p>
 *
 * <p>Logic is lifted verbatim from
 * {@link PatternAnalysisAssembler#computePatternString(DrawResultPattern)}
 * (FR-015 DRY mandate). Any future change to the fingerprint algorithm must be
 * made here - {@code PatternAnalysisAssembler} delegates to this method.</p>
 */
final class DrawFingerprintUtil {

    /** Bucket size used when partitioning the pool into decade ranges. */
    private static final int BUCKET_SIZE = 10;

    /**
     * Suppresses instantiation - utility class with only static methods
     * (Effective Java Item 4).
     *
     * @throws AssertionError always
     */
    private DrawFingerprintUtil() {
        throw new AssertionError("DrawFingerprintUtil must not be instantiated");
    }

    /**
     * Computes the decade-bucket fingerprint string for one draw.
     *
     * <p>Algorithm: bucket k = n/10; bucketCount = (pool/10)+1; winners = gamesOut==0.
     * Returns {@code ""} for null/empty/pool&le;0/no-winners input (Item 54).</p>
     *
     * @param draw the draw to fingerprint; must not be {@code null}
     * @return dash-joined decade-bucket counts, or {@code ""} if the draw cannot be
     *         fingerprinted (null/empty numbers, pool &le; 0, or no winners)
     */
    static String computeFingerprint(DrawResultPattern draw) {
        if (draw == null || draw.lotteryNumbers() == null || draw.lotteryNumbers().isEmpty()) {
            return "";
        }

        int pool = draw.lotteryNumbers().stream()
                .mapToInt(LotteryNumber::number)
                .max()
                .orElse(0);

        if (pool <= 0) {
            return "";
        }

        // Collect winners (gamesOut == 0)
        List<Integer> hitNumbers = draw.lotteryNumbers().stream()
                .filter(ln -> ln.gamesOut() == 0)
                .map(LotteryNumber::number)
                .sorted()
                .toList();

        if (hitNumbers.isEmpty()) {
            return "";
        }

        // Decade bucketing: bucketIndex = n / BUCKET_SIZE; bucketCount = (pool / BUCKET_SIZE) + 1
        int bucketCount = (pool / BUCKET_SIZE) + 1;
        int[] counts = new int[bucketCount];

        for (int number : hitNumbers) {
            int bucketIndex = number / BUCKET_SIZE;
            counts[bucketIndex]++;
        }

        return String.join("-",
                Arrays.stream(counts)
                      .mapToObj(Integer::toString)
                      .toArray(String[]::new));
    }
}
