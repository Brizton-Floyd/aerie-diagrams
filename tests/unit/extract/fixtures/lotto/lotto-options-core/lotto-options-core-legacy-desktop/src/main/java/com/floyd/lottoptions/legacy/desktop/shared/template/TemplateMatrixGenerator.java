package com.floyd.lottoptions.legacy.desktop.shared.template;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Generates all possible TemplateMatrix templates for a given lottery configuration
 * and calculates their mathematical probabilities using combinatorial mathematics.
 * 
 * This class implements the core mathematical engine of the TemplateMatrix methodology,
 * generating templates based on Low-Odd, Low-Even, High-Odd, High-Even distributions.
 */
public class TemplateMatrixGenerator {
    
    private static final MathContext PRECISION = new MathContext(10, RoundingMode.HALF_UP);
    
    /**
     * Generates all possible templates for a lottery configuration.
     * 
     * @param minNumber Minimum number in the lottery range (e.g., 1)
     * @param maxNumber Maximum number in the lottery range (e.g., 35)
     * @param pickSize Number of numbers drawn (e.g., 5)
     * @return List of all possible TemplateMatrix templates with calculated probabilities
     */
    public List<TemplateMatrixTemplate> generateAllTemplates(int minNumber, int maxNumber, int pickSize) {
        
        int midpoint = (minNumber + maxNumber) / 2;
        List<TemplateMatrixTemplate> templates = new ArrayList<>();
        
        // Calculate the counts for each category
        NumberCategoryCounts categoryCounts = calculateCategoryCounts(minNumber, maxNumber, midpoint);
        
        // Generate all possible combinations where LO + LE + HO + HE = pickSize
        for (int lo = 0; lo <= Math.min(pickSize, categoryCounts.lowOddCount); lo++) {
            for (int le = 0; le <= Math.min(pickSize - lo, categoryCounts.lowEvenCount); le++) {
                for (int ho = 0; ho <= Math.min(pickSize - lo - le, categoryCounts.highOddCount); ho++) {
                    int he = pickSize - lo - le - ho;
                    
                    // Validate that we have enough numbers in the high-even category
                    if (he >= 0 && he <= categoryCounts.highEvenCount) {
                        double probability = calculateTemplateProbability(
                                lo, le, ho, he, 
                                categoryCounts, 
                                maxNumber, pickSize);
                        
                        TemplateMatrixTemplate template = new TemplateMatrixTemplate(
                                lo, le, ho, he, probability, midpoint);
                        
                        templates.add(template);
                    }
                }
            }
        }
        
        // Sort templates by probability (highest first)
        templates.sort((t1, t2) -> t2.getProbability().compareTo(t1.getProbability()));
        
        // Assign template groups based on probability percentiles
        assignTemplateGroups(templates);
        
        return templates;
    }
    
    /**
     * Calculates the probability of a specific template occurring.
     * Uses hypergeometric distribution principles for combinatorial probability.
     */
    private double calculateTemplateProbability(int lo, int le, int ho, int he,
                                              NumberCategoryCounts counts,
                                              int totalNumbers, int pickSize) {
        try {
            // Calculate combinations for each category
            BigDecimal loCombs = calculateCombination(counts.lowOddCount, lo);
            BigDecimal leCombs = calculateCombination(counts.lowEvenCount, le);
            BigDecimal hoCombs = calculateCombination(counts.highOddCount, ho);
            BigDecimal heCombs = calculateCombination(counts.highEvenCount, he);
            
            // Total favorable outcomes
            BigDecimal numerator = loCombs.multiply(leCombs, PRECISION)
                                          .multiply(hoCombs, PRECISION)
                                          .multiply(heCombs, PRECISION);
            
            // Total possible outcomes
            BigDecimal denominator = calculateCombination(totalNumbers, pickSize);
            
            // Probability = favorable / total
            if (denominator.compareTo(BigDecimal.ZERO) == 0) {
                return 0.0;
            }
            
            return numerator.divide(denominator, PRECISION).doubleValue();
            
        } catch (Exception e) {
            System.err.println("Error calculating probability for template " + 
                             lo + "-" + le + "-" + ho + "-" + he + ": " + e.getMessage());
            return 0.0;
        }
    }
    
    /**
     * Calculates combination (nCr) using BigDecimal for precision.
     */
    private BigDecimal calculateCombination(int n, int r) {
        if (r > n || r < 0) {
            return BigDecimal.ZERO;
        }
        if (r == 0 || r == n) {
            return BigDecimal.ONE;
        }
        
        // Use the symmetry property: nCr = nC(n-r)
        r = Math.min(r, n - r);
        
        BigDecimal result = BigDecimal.ONE;
        
        for (int i = 0; i < r; i++) {
            result = result.multiply(BigDecimal.valueOf(n - i), PRECISION)
                          .divide(BigDecimal.valueOf(i + 1), PRECISION);
        }
        
        return result;
    }
    
    /**
     * Calculates the count of numbers in each category.
     */
    private NumberCategoryCounts calculateCategoryCounts(int minNumber, int maxNumber, int midpoint) {
        int lowOddCount = 0, lowEvenCount = 0;
        int highOddCount = 0, highEvenCount = 0;
        
        for (int number = minNumber; number <= maxNumber; number++) {
            if (number <= midpoint) {
                if (number % 2 == 1) {
                    lowOddCount++;
                } else {
                    lowEvenCount++;
                }
            } else {
                if (number % 2 == 1) {
                    highOddCount++;
                } else {
                    highEvenCount++;
                }
            }
        }
        
        return new NumberCategoryCounts(lowOddCount, lowEvenCount, highOddCount, highEvenCount);
    }
    
    /**
     * Assigns template groups based on probability percentiles.
     */
    private void assignTemplateGroups(List<TemplateMatrixTemplate> templates) {
        int totalTemplates = templates.size();
        
        int bestCount = 0, goodCount = 0, fairCount = 0, poorCount = 0;
        
        for (int i = 0; i < totalTemplates; i++) {
            double percentile = 1.0 - ((double) i / totalTemplates);
            TemplateGroup group = TemplateGroup.fromProbabilityPercentile(percentile);
            templates.get(i).setTemplateGroup(group);
            
            // Count assignments for debugging
            switch (group) {
                case BEST: bestCount++; break;
                case GOOD: goodCount++; break;
                case FAIR: fairCount++; break;
                case POOR: poorCount++; break;
            }
        }
        
        System.out.println(String.format("Template Group Assignment: BEST=%d, GOOD=%d, FAIR=%d, POOR=%d (total=%d)", 
                                        bestCount, goodCount, fairCount, poorCount, totalTemplates));
    }
    
    /**
     * Generates templates for common lottery configurations.
     */
    public List<TemplateMatrixTemplate> generateTemplatesForLotteryType(LotteryType lotteryType) {
        switch (lotteryType) {
            case CASH_FIVE_35:
                return generateAllTemplates(1, 35, 5);
            case PICK_6_49:
                return generateAllTemplates(1, 49, 6);
            case PICK_6_54:
                return generateAllTemplates(1, 54, 6);
            case POWERBALL_MAIN:
                return generateAllTemplates(1, 69, 5);
            case MEGA_MILLIONS_MAIN:
                return generateAllTemplates(1, 70, 5);
            default:
                throw new IllegalArgumentException("Unsupported lottery type: " + lotteryType);
        }
    }
    
    /**
     * Generates a summary report of template distribution.
     */
    public TemplateGenerationSummary generateSummary(List<TemplateMatrixTemplate> templates) {
        Map<TemplateGroup, Long> groupCounts = templates.stream()
                .collect(Collectors.groupingBy(
                    TemplateMatrixTemplate::getTemplateGroup,
                    Collectors.counting()
                ));
        
        double totalProbability = templates.stream()
                .mapToDouble(t -> t.getProbability().doubleValue())
                .sum();
        
        TemplateMatrixTemplate highestProb = templates.isEmpty() ? null : templates.get(0);
        TemplateMatrixTemplate lowestProb = templates.isEmpty() ? null : templates.get(templates.size() - 1);
        
        return new TemplateGenerationSummary(
                templates.size(),
                groupCounts,
                totalProbability,
                highestProb,
                lowestProb
        );
    }
    
    /**
     * Inner class for storing number category counts.
     */
    private static class NumberCategoryCounts {
        final int lowOddCount;
        final int lowEvenCount;
        final int highOddCount;
        final int highEvenCount;
        
        NumberCategoryCounts(int lowOddCount, int lowEvenCount, int highOddCount, int highEvenCount) {
            this.lowOddCount = lowOddCount;
            this.lowEvenCount = lowEvenCount;
            this.highOddCount = highOddCount;
            this.highEvenCount = highEvenCount;
        }
        
        @Override
        public String toString() {
            return String.format("Counts[LO=%d, LE=%d, HO=%d, HE=%d]", 
                               lowOddCount, lowEvenCount, highOddCount, highEvenCount);
        }
    }
    
    /**
     * Enum for common lottery types.
     */
    public enum LotteryType {
        CASH_FIVE_35("Cash 5 (1-35)", 1, 35, 5),
        PICK_6_49("Pick 6 (1-49)", 1, 49, 6),
        PICK_6_54("Pick 6 (1-54)", 1, 54, 6),
        POWERBALL_MAIN("Powerball Main (1-69)", 1, 69, 5),
        MEGA_MILLIONS_MAIN("Mega Millions Main (1-70)", 1, 70, 5);
        
        private final String displayName;
        private final int minNumber;
        private final int maxNumber;
        private final int pickSize;
        
        LotteryType(String displayName, int minNumber, int maxNumber, int pickSize) {
            this.displayName = displayName;
            this.minNumber = minNumber;
            this.maxNumber = maxNumber;
            this.pickSize = pickSize;
        }
        
        public String getDisplayName() { return displayName; }
        public int getMinNumber() { return minNumber; }
        public int getMaxNumber() { return maxNumber; }
        public int getPickSize() { return pickSize; }
    }
    
    /**
     * Summary of template generation results.
     */
    public static class TemplateGenerationSummary {
        private final int totalTemplates;
        private final Map<TemplateGroup, Long> groupCounts;
        private final double totalProbability;
        private final TemplateMatrixTemplate highestProbTemplate;
        private final TemplateMatrixTemplate lowestProbTemplate;
        
        public TemplateGenerationSummary(int totalTemplates, 
                                       Map<TemplateGroup, Long> groupCounts,
                                       double totalProbability,
                                       TemplateMatrixTemplate highestProbTemplate,
                                       TemplateMatrixTemplate lowestProbTemplate) {
            this.totalTemplates = totalTemplates;
            this.groupCounts = groupCounts;
            this.totalProbability = totalProbability;
            this.highestProbTemplate = highestProbTemplate;
            this.lowestProbTemplate = lowestProbTemplate;
        }
        
        // Getters
        public int getTotalTemplates() { return totalTemplates; }
        public Map<TemplateGroup, Long> getGroupCounts() { return groupCounts; }
        public double getTotalProbability() { return totalProbability; }
        public TemplateMatrixTemplate getHighestProbTemplate() { return highestProbTemplate; }
        public TemplateMatrixTemplate getLowestProbTemplate() { return lowestProbTemplate; }
        
        @Override
        public String toString() {
            return String.format(
                    "Template Generation Summary: %d templates generated\n" +
                    "Probability coverage: %.1f%%\n" +
                    "Best template: %s (%.4f%%)\n" +
                    "Distribution: %s",
                    totalTemplates,
                    totalProbability * 100,
                    highestProbTemplate != null ? highestProbTemplate.getPatternString() : "None",
                    highestProbTemplate != null ? highestProbTemplate.getProbability().doubleValue() * 100 : 0,
                    groupCounts
            );
        }
    }
}