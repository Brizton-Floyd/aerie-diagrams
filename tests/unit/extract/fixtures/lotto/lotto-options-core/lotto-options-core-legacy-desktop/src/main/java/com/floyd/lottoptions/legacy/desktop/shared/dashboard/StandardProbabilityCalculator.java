package com.floyd.lottoptions.legacy.desktop.shared.dashboard;

import com.floyd.persistence.model.LotteryGame;

/**
 * A probability calculator for standard lottery games where numbers are drawn without replacement.
 * This implementation uses the standard binomial coefficient (n choose r) to calculate probabilities.
 */
public class StandardProbabilityCalculator implements ProbabilityCalculator {

    @Override
    public double calculate(String numericalRepresentation, int group1Count, int group2Count, LotteryGame game) {
        String[] parts = numericalRepresentation.split(" ");
        
        // Handle cases where numericalRepresentation format is unexpected
        if (parts.length < 3) {
            // If format is unexpected, use equal distribution as fallback
            int chosenGroup1 = Math.min(group1Count / 2, Integer.parseInt(parts[0]));
            int chosenGroup2 = Math.max(1, group2Count - chosenGroup1);
            
            long totalCombinationsForPattern = combination(group1Count, chosenGroup1) * combination(group2Count, chosenGroup2);
            long totalCombinations = combination(game.getMaxNumber() - game.getMinNumber() + 1, game.getDrawPositionCount());
            
            if (totalCombinations == 0) {
                return 0.0;
            }
            return (double) totalCombinationsForPattern / totalCombinations;
        }
        
        int chosenGroup1 = Integer.parseInt(parts[0]);
        int chosenGroup2 = Integer.parseInt(parts[2]);

        long totalCombinationsForPattern = combination(group1Count, chosenGroup1) * combination(group2Count, chosenGroup2);
        long totalCombinations = combination(game.getMaxNumber() - game.getMinNumber() + 1, game.getDrawPositionCount());

        if (totalCombinations == 0) {
            return 0.0;
        }

        return (double) totalCombinationsForPattern / totalCombinations;
    }

    /**
     * Calculates the binomial coefficient (n choose r).
     *
     * @param n The total number of items.
     * @param r The number of items to choose.
     * @return The number of combinations.
     */
    private long combination(int n, int r) {
        if (r < 0 || r > n) {
            return 0;
        }
        if (r == 0 || r == n) {
            return 1;
        }
        if (r > n / 2) {
            r = n - r;
        }
        long res = 1;
        for (int i = 1; i <= r; i++) {
            res = res * (n - i + 1) / i;
        }
        return res;
    }
}
