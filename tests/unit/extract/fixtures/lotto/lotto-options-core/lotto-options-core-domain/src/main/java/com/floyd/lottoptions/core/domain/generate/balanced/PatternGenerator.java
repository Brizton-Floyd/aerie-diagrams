package com.floyd.lottoptions.core.domain.generate.balanced;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Lists every balanced spread a game's tickets can have, with its theoretical probability.
 */
public final class PatternGenerator {

    /** Most probable first; equally probable spreads keep the order they were listed in. */
    static final Comparator<Pattern> MOST_PROBABLE_FIRST = Comparator.comparing(Pattern::probability).reversed();

    private PatternGenerator() {
    }

    /**
     * Lists every way to spread {@code drawCount} numbers of the field 1..{@code totalNumbers}
     * over the four categories, most probable first. A number is low up to
     * {@code totalNumbers / 2}.
     *
     * @param totalNumbers the field's largest number; the field starts at 1
     * @param drawCount    the numbers per ticket
     * @return the spreads, most probable first; empty when the field has fewer than
     *         {@code drawCount} numbers
     */
    public static List<Pattern> generatePatterns(int totalNumbers, int drawCount) {
        List<Pattern> patterns = new ArrayList<>();
        int midpoint = totalNumbers / 2;

        int lowerOddCount = (midpoint + 1) / 2;
        int lowerEvenCount = midpoint / 2;
        int upperOddCount = (totalNumbers - midpoint + 1) / 2;
        int upperEvenCount = (totalNumbers - midpoint) / 2;

        long totalCombinations = combination(totalNumbers, drawCount);
        if (totalCombinations == 0) {
            return patterns;
        }

        for (int k = 0; k <= drawCount; k++) { // k = count of lower-odd numbers
            for (int m = 0; m <= drawCount - k; m++) { // m = count of lower-even numbers
                for (int n = 0; n <= drawCount - k - m; n++) { // n = count of upper-odd numbers
                    int p = drawCount - k - m - n; // p = count of upper-even numbers
                    long patternCombinations = combination(lowerOddCount, k)
                            * combination(lowerEvenCount, m)
                            * combination(upperOddCount, n)
                            * combination(upperEvenCount, p);

                    double probability = (double) patternCombinations / totalCombinations;
                    patterns.add(new Pattern(k, m, n, p, probability, midpoint));
                }
            }
        }

        patterns.sort(MOST_PROBABLE_FIRST);
        return patterns;
    }

    /**
     * The ways to choose {@code k} of {@code n} items; {@code 0} when {@code k} is negative or
     * above {@code n}.
     */
    private static long combination(int n, int k) {
        if (k < 0 || k > n) {
            return 0;
        }
        if (k == 0 || k == n) {
            return 1;
        }
        int smaller = k > n / 2 ? n - k : k;
        long res = 1;
        for (int i = 1; i <= smaller; i++) {
            res = res * (n - i + 1) / i;
        }
        return res;
    }
}
