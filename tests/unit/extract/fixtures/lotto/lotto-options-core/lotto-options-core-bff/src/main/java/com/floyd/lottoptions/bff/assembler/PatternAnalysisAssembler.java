package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.PatternAnalysisViewModel;
import com.floyd.lottoptions.bff.viewmodel.PatternEntryViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Pure assembler that derives the Pattern Analysis panel data from the draw history.
 *
 * <p>Mirrors {@code refreshPatternAnalysis} and {@code calculatePatternString}
 * (DashBoardController.java:1917–2244, FR-006-D, ADR-0003). Caps input at the last
 * {@link #PATTERN_CAP} draws for performance parity with the desktop.</p>
 *
 * <p>Pattern string definition (FR-012, rework - decade bucketing): for a single draw,
 * split the pool into decade buckets by integer division: {@code bucketIndex = n / BUCKET_SIZE}.
 * Bucket 0 holds numbers 1–9; bucket 1 holds 10–19; bucket 2 holds 20–29; etc.
 * Bucket count = {@code (pool / BUCKET_SIZE) + 1}. Count how many of the draw's
 * winning numbers (gamesOut == 0) fall in each bucket. Join the counts with "-".
 * The resulting string's parts sum to the draw's pick count.
 * Example: winners {3, 12, 15, 28, 33} with pool 35 → bucketCount 4 → "1-2-1-1"
 * (3→b0, 12→b1, 15→b1, 28→b2, 33→b3).</p>
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). No I/O, no reactive types.</p>
 */
@Component
public final class PatternAnalysisAssembler {

    /** Maximum draws analysed - mirrors the desktop's performance cap (:1924–1934). */
    static final int PATTERN_CAP = 500;

    /**
     * Builds the full Pattern Analysis view model.
     *
     * @param patterns the full draw history; may be {@code null}
     * @return view model with current pattern, top-5 predictions, and all patterns;
     *         returns empty lists (never null) when input is null/empty
     */
    public PatternAnalysisViewModel buildPatternAnalysis(List<DrawResultPattern> patterns) {
        if (patterns == null || patterns.isEmpty()) {
            return emptyViewModel();
        }

        // Cap to last PATTERN_CAP draws
        List<DrawResultPattern> working;
        if (patterns.size() > PATTERN_CAP) {
            working = patterns.subList(patterns.size() - PATTERN_CAP, patterns.size());
        } else {
            working = patterns;
        }

        if (working.size() < 1) {
            return emptyViewModel();
        }

        // Compute bucket-based pattern string for each draw (starting at index 0)
        // patternFreq: patternString → frequency
        Map<String, Integer> patternFreq = new LinkedHashMap<>();
        // patternLastSeen: patternString → last draw index where it appeared (0-based in working)
        Map<String, Integer> patternLastSeen = new HashMap<>();

        for (int i = 0; i < working.size(); i++) {
            String ps = computePatternString(working.get(i));
            if (ps != null && !ps.isEmpty()) {
                patternFreq.merge(ps, 1, Integer::sum);
                patternLastSeen.put(ps, i);
            }
        }

        if (patternFreq.isEmpty()) {
            return emptyViewModel();
        }

        int latestIndex = working.size() - 1; // index of the most recent draw

        // Current pattern (from the most recent draw)
        String currentPs = computePatternString(working.get(latestIndex));
        PatternEntryViewModel currentPattern = buildEntry(currentPs, patternFreq, patternLastSeen, latestIndex);

        // All patterns sorted by frequency descending
        List<PatternEntryViewModel> allPatterns = patternFreq.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(e -> buildEntry(e.getKey(), patternFreq, patternLastSeen, latestIndex))
                .collect(Collectors.toList());

        // Top-5 predicted: patterns similar to currentPattern (within 2-digit difference)
        List<PatternEntryViewModel> topPredicted = allPatterns.stream()
                .filter(e -> currentPs != null && isSimilarPattern(currentPs, e.patternString()))
                .limit(5)
                .toList();

        return new PatternAnalysisViewModel(currentPattern, List.copyOf(topPredicted), List.copyOf(allPatterns));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private PatternAnalysisViewModel emptyViewModel() {
        PatternEntryViewModel empty = new PatternEntryViewModel("", 0, 0);
        return new PatternAnalysisViewModel(empty, List.of(), List.of());
    }

    /**
     * Computes the decade-bucket pattern fingerprint for a single draw.
     *
     * <p>Algorithm (FR-012, rework - decade bucketing):
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
     * @param current the draw to fingerprint
     * @return dash-joined decade-bucket counts, or {@code ""} if the draw cannot be fingerprinted
     */
    private String computePatternString(DrawResultPattern current) {
        return DrawFingerprintUtil.computeFingerprint(current);
    }

    private PatternEntryViewModel buildEntry(
            String patternString,
            Map<String, Integer> patternFreq,
            Map<String, Integer> patternLastSeen,
            int latestIndex) {
        if (patternString == null || patternString.isEmpty()) {
            return new PatternEntryViewModel("", 0, 0);
        }
        int freq = patternFreq.getOrDefault(patternString, 0);
        int lastIdx = patternLastSeen.getOrDefault(patternString, -1);
        int drawsAgo = lastIdx < 0 ? 0 : latestIndex - lastIdx;
        return new PatternEntryViewModel(patternString, freq, drawsAgo);
    }

    /**
     * Returns true if patterns differ in at most 2 digit positions (mirrors
     * {@code isSimilarPattern}, DashBoardController.java:2332–2349).
     */
    private boolean isSimilarPattern(String a, String b) {
        if (a.equals(b)) return true;
        String[] aParts = a.split("-");
        String[] bParts = b.split("-");
        if (aParts.length != bParts.length) return false;
        int diff = 0;
        for (int i = 0; i < aParts.length; i++) {
            if (!aParts[i].equals(bParts[i])) diff++;
        }
        return diff <= 2;
    }
}
