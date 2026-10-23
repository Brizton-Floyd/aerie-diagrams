package com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical;

import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateGroup;

import java.util.ArrayList;
import java.util.List;

/**
 * Generates all possible categorical patterns for a lottery game based on its configuration.
 * A pattern is defined by the distribution of drawn numbers across four categories: lower-odd, lower-even,
 * upper-odd, and upper-even. This generator calculates every possible combination of these categories
 * for a given draw count and determines the theoretical probability of each pattern.
 */
public class PatternGenerator {

    /**
     * Generates a list of all possible categorical patterns for a given lottery game configuration.
     * It systematically iterates through all combinations of how the drawn numbers can be distributed
     * among the four categories (LO, LE, UO, UE) and calculates the probability for each.
     *
     * @param totalNumbers The total count of numbers in the lottery's number field (e.g., 49 in a 6/49 game).
     * @param drawCount    The number of numbers drawn in each game (e.g., 6 in a 6/49 game).
     * @return A list of {@link Pattern} objects, each representing a unique possible categorical distribution.
     */
    public List<Pattern> generatePatterns(int totalNumbers, int drawCount) {
        List<Pattern> patterns = new ArrayList<>();
        int midpoint = totalNumbers / 2;

        // Calculate the number of available numbers in each of the four categories.
        // Assumes the number range starts from 1.
        int lowerOddCount = (midpoint + 1) / 2;
        int lowerEvenCount = midpoint / 2;
        int upperOddCount = (totalNumbers - midpoint + 1) / 2;
        int upperEvenCount = (totalNumbers - midpoint) / 2;

        long totalCombinations = combination(totalNumbers, drawCount);
        if (totalCombinations == 0) {
            return patterns; // Return empty list if total combinations is zero
        }

        // Iterate through all possible distributions of drawCount across the four categories
        for (int k = 0; k <= drawCount; k++) { // k = count of lower-odd numbers
            for (int m = 0; m <= drawCount - k; m++) { // m = count of lower-even numbers
                for (int n = 0; n <= drawCount - k - m; n++) { // n = count of upper-odd numbers
                    int p = drawCount - k - m - n; // p = count of upper-even numbers
                    if (p >= 0) {
                        // Calculate the number of ways this specific pattern can be formed
                        long patternCombinations = combination(lowerOddCount, k) *
                                combination(lowerEvenCount, m) *
                                combination(upperOddCount, n) *
                                combination(upperEvenCount, p);

                        // Calculate the probability of this pattern
                        double probability = (double) patternCombinations / totalCombinations;
                        patterns.add(new Pattern(k, m, n, p, probability, midpoint));
                    }
                }
            }
        }
        
        // Sort patterns by probability (highest first)
        patterns.sort((p1, p2) -> p2.getProbability().compareTo(p1.getProbability()));
        
        // Apply basic group classification based on probability percentiles
        applyBasicGroupClassification(patterns);
        
        return patterns;
    }

    /**
     * Calculates the binomial coefficient C(n, k), also known as "n choose k".
     * This represents the number of ways to choose k items from a set of n items without repetition.
     *
     * @param n The total number of items in the set.
     * @param k The number of items to choose.
     * @return The number of possible combinations. Returns 0 if k > n or k < 0.
     */
    private long combination(int n, int k) {
        if (k < 0 || k > n) {
            return 0;
        }
        if (k == 0 || k == n) {
            return 1;
        }
        // Symmetry: C(n, k) == C(n, n-k)
        if (k > n / 2) {
            k = n - k;
        }
        long res = 1;
        for (int i = 1; i <= k; i++) {
            res = res * (n - i + 1) / i;
        }
        return res;
    }
    
    /**
     * Applies basic group classification based on probability percentiles.
     */
    private void applyBasicGroupClassification(List<Pattern> patterns) {
        int totalPatterns = patterns.size();
        
        for (int i = 0; i < totalPatterns; i++) {
            double percentile = 1.0 - ((double) i / totalPatterns);
            TemplateGroup group = TemplateGroup.fromProbabilityPercentile(percentile);
            patterns.get(i).setTemplateGroup(group);
        }
    }
}