package com.floyd.lottoptions.legacy.desktop.generation.delta;

import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeDroughtAnalysis;
import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeTierDrought;
import com.floyd.persistence.model.LotteryGame;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Drought analyzer that enhances delta pattern selection with drought intelligence.
 * 
 * This component analyzes current drought conditions and influences delta pattern
 * selection to target numbers and ranges that align with drought opportunities,
 * while maintaining the mathematical integrity of the delta algorithm.
 */
public class DeltaDroughtAnalyzer {
    
    private final LotteryGame lotteryGame;
    private final DeltaScalingCalculator scalingCalculator;
    private final DeltaBasePatternLibrary patternLibrary;
    
    /**
     * Creates a drought analyzer for delta patterns.
     * 
     * @param lotteryGame The lottery game configuration
     */
    public DeltaDroughtAnalyzer(LotteryGame lotteryGame) {
        this.lotteryGame = lotteryGame;
        this.scalingCalculator = new DeltaScalingCalculator(lotteryGame);
        this.patternLibrary = new DeltaBasePatternLibrary();
    }
    
    /**
     * Analyzes drought conditions and provides pattern selection guidance.
     * 
     * @param droughtAnalysis Current drought analysis data
     * @return DroughtGuidance for pattern selection
     */
    public DroughtGuidance analyzeDroughtConditions(PrizeDroughtAnalysis droughtAnalysis) {
        if (droughtAnalysis == null || !droughtAnalysis.hasActiveDroughts()) {
            return DroughtGuidance.neutral();
        }
        
        // Find highest priority drought tier
        String priorityTier = droughtAnalysis.getHighestPriorityPrizeTier();
        double droughtWeight = droughtAnalysis.getTargetingWeight(priorityTier);
        
        // Analyze number range preferences based on drought
        NumberRangePreferences rangePreferences = analyzeRangePreferences(droughtAnalysis);
        
        // Calculate pattern priority adjustments
        Map<String, Double> patternAdjustments = calculatePatternPriorityAdjustments(droughtAnalysis, rangePreferences);
        
        // Generate starting number preferences
        List<Integer> preferredStarts = calculatePreferredStartingNumbers(droughtAnalysis, rangePreferences);
        
        return new DroughtGuidance(
            priorityTier,
            droughtWeight,
            rangePreferences,
            patternAdjustments,
            preferredStarts,
            generateDroughtRecommendations(droughtAnalysis, rangePreferences)
        );
    }
    
    /**
     * Applies drought guidance to prioritize delta patterns.
     * 
     * @param basePatterns Original delta patterns
     * @param droughtGuidance Drought analysis guidance
     * @return Prioritized patterns with drought-informed weighting
     */
    public List<WeightedDeltaPattern> applyDroughtGuidance(List<int[]> basePatterns, DroughtGuidance droughtGuidance) {
        List<WeightedDeltaPattern> weightedPatterns = new ArrayList<>();
        
        for (int[] pattern : basePatterns) {
            double baseScore = patternLibrary.getPatternPriorityScore(pattern);
            double droughtAdjustment = calculateDroughtAdjustment(pattern, droughtGuidance);
            double finalWeight = baseScore + droughtAdjustment;
            
            weightedPatterns.add(new WeightedDeltaPattern(pattern, finalWeight, droughtAdjustment));
        }
        
        // Sort by final weight (highest first)
        weightedPatterns.sort((a, b) -> Double.compare(b.getFinalWeight(), a.getFinalWeight()));
        
        return weightedPatterns;
    }
    
    /**
     * Creates drought-informed pattern variations.
     * 
     * @param basePattern Original pattern
     * @param droughtGuidance Drought guidance
     * @param variationCount Number of variations to create
     * @return List of drought-informed pattern variations
     */
    public List<int[]> createDroughtInformedVariations(int[] basePattern, DroughtGuidance droughtGuidance, int variationCount) {
        List<int[]> variations = new ArrayList<>();
        
        if (droughtGuidance.isNeutral()) {
            return variations; // No drought guidance available
        }
        
        // Create starting number variations based on drought preferences
        List<Integer> preferredStarts = droughtGuidance.getPreferredStartingNumbers();
        for (int i = 0; i < Math.min(variationCount, preferredStarts.size()); i++) {
            int preferredStart = preferredStarts.get(i);
            int[] variation = basePattern.clone();
            variation[0] = preferredStart;
            variations.add(variation);
        }
        
        // Create gap variations that align with drought range preferences
        if (variations.size() < variationCount) {
            NumberRangePreferences rangePrefs = droughtGuidance.getRangePreferences();
            variations.addAll(createRangeAlignedVariations(basePattern, rangePrefs, variationCount - variations.size()));
        }
        
        return variations;
    }
    
    // Private implementation methods
    
    private NumberRangePreferences analyzeRangePreferences(PrizeDroughtAnalysis droughtAnalysis) {
        int numberRange = lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1;
        int lowEnd = numberRange / 3;
        int highStart = numberRange * 2 / 3;
        
        // Default preferences
        double lowRangeWeight = 1.0;
        double midRangeWeight = 1.0; 
        double highRangeWeight = 1.0;
        
        // Analyze drought patterns to determine range preferences
        // This is simplified - in practice would analyze historical drought patterns
        String priorityTier = droughtAnalysis.getHighestPriorityPrizeTier();
        if (priorityTier != null) {
            // Higher tier droughts might benefit from more balanced distribution
            if (priorityTier.contains("6-of-") || priorityTier.contains("5-of-5")) {
                highRangeWeight = 1.3; // Emphasis on high numbers for jackpot targeting
            } else if (priorityTier.contains("4-of-") || priorityTier.contains("3-of-")) {
                lowRangeWeight = 1.2; // Emphasis on low numbers for secondary prizes
            }
        }
        
        return new NumberRangePreferences(lowRangeWeight, midRangeWeight, highRangeWeight, lowEnd, highStart);
    }
    
    private Map<String, Double> calculatePatternPriorityAdjustments(PrizeDroughtAnalysis droughtAnalysis, NumberRangePreferences rangePrefs) {
        Map<String, Double> adjustments = new HashMap<>();
        
        double droughtIntensity = droughtAnalysis.getOverallDroughtScore();
        
        // Boost arithmetic patterns during high drought periods
        if (droughtIntensity > 0.7) {
            adjustments.put("ARITHMETIC", 5.0);
            adjustments.put("PRIMARY", 3.0);
        } else if (droughtIntensity > 0.5) {
            adjustments.put("ARITHMETIC", 2.0);
            adjustments.put("PRIMARY", 1.0);
        }
        
        return adjustments;
    }
    
    private List<Integer> calculatePreferredStartingNumbers(PrizeDroughtAnalysis droughtAnalysis, NumberRangePreferences rangePrefs) {
        List<Integer> preferredStarts = new ArrayList<>();
        int[] optimalStartRange = scalingCalculator.getOptimalStartRange();
        
        // Weight starting numbers based on range preferences
        for (int start = optimalStartRange[0]; start <= optimalStartRange[1]; start++) {
            // Add starts that align with drought preferences
            if (rangePrefs.getLowRangeWeight() > 1.0 && start <= rangePrefs.getLowEnd()) {
                preferredStarts.add(start);
            } else if (start <= optimalStartRange[1] / 2) {
                preferredStarts.add(start); // Always include some low starts
            }
        }
        
        // If no preferred starts found, use default optimal range
        if (preferredStarts.isEmpty()) {
            for (int start = optimalStartRange[0]; start <= Math.min(optimalStartRange[1], 5); start++) {
                preferredStarts.add(start);
            }
        }
        
        return preferredStarts;
    }
    
    private double calculateDroughtAdjustment(int[] pattern, DroughtGuidance guidance) {
        if (guidance.isNeutral()) {
            return 0.0;
        }
        
        double adjustment = 0.0;
        
        // Pattern type adjustment
        String patternType = determinePatternType(pattern);
        Double typeAdjustment = guidance.getPatternAdjustments().get(patternType);
        if (typeAdjustment != null) {
            adjustment += typeAdjustment;
        }
        
        // Starting number preference adjustment
        if (guidance.getPreferredStartingNumbers().contains(pattern[0])) {
            adjustment += guidance.getDroughtWeight() * 2.0;
        }
        
        // Range alignment adjustment
        adjustment += calculateRangeAlignmentAdjustment(pattern, guidance.getRangePreferences());
        
        return adjustment * guidance.getDroughtWeight();
    }
    
    private String determinePatternType(int[] pattern) {
        if (patternLibrary.isArithmeticProgression(pattern)) {
            return "ARITHMETIC";
        }
        
        int priority = patternLibrary.getPatternPriorityScore(pattern);
        if (priority >= 100) return "PRIMARY";
        if (priority >= 80) return "SECONDARY";
        if (priority >= 50) return "COMMON";
        return "CUSTOM";
    }
    
    private double calculateRangeAlignmentAdjustment(int[] pattern, NumberRangePreferences rangePrefs) {
        // Calculate where the pattern's numbers would fall
        int[] scaledNumbers = scalingCalculator.deltaPatternToLotteryNumbers(pattern);
        if (scaledNumbers == null) return 0.0;
        
        double adjustment = 0.0;
        
        for (int number : scaledNumbers) {
            if (number <= rangePrefs.getLowEnd()) {
                adjustment += (rangePrefs.getLowRangeWeight() - 1.0) * 0.5;
            } else if (number >= rangePrefs.getHighStart()) {
                adjustment += (rangePrefs.getHighRangeWeight() - 1.0) * 0.5;
            } else {
                adjustment += (rangePrefs.getMidRangeWeight() - 1.0) * 0.5;
            }
        }
        
        return adjustment / scaledNumbers.length; // Average adjustment per number
    }
    
    private List<int[]> createRangeAlignedVariations(int[] basePattern, NumberRangePreferences rangePrefs, int count) {
        List<int[]> variations = new ArrayList<>();
        
        // Create variations with adjusted gaps to hit preferred ranges
        int[] gapRange = scalingCalculator.getOptimalGapRange();
        
        for (int i = 0; i < count; i++) {
            int[] variation = basePattern.clone();
            
            // Adjust gaps based on range preferences
            for (int j = 1; j < variation.length; j++) {
                if (rangePrefs.getHighRangeWeight() > 1.2) {
                    // Increase gaps to reach high range
                    variation[j] = Math.min(gapRange[1], variation[j] + 1);
                } else if (rangePrefs.getLowRangeWeight() > 1.2) {
                    // Decrease gaps to stay in low range
                    variation[j] = Math.max(gapRange[0], variation[j] - 1);
                }
            }
            
            variations.add(variation);
        }
        
        return variations;
    }
    
    private List<String> generateDroughtRecommendations(PrizeDroughtAnalysis droughtAnalysis, NumberRangePreferences rangePrefs) {
        List<String> recommendations = new ArrayList<>();
        
        String priorityTier = droughtAnalysis.getHighestPriorityPrizeTier();
        if (priorityTier != null) {
            recommendations.add("Focus on " + priorityTier + " patterns due to active drought");
        }
        
        if (rangePrefs.getHighRangeWeight() > 1.1) {
            recommendations.add("Emphasize higher numbers for better drought alignment");
        } else if (rangePrefs.getLowRangeWeight() > 1.1) {
            recommendations.add("Target lower number ranges based on drought analysis");
        }
        
        if (droughtAnalysis.getOverallDroughtScore() > 0.7) {
            recommendations.add("High drought intensity - prioritize arithmetic progressions");
        }
        
        return recommendations;
    }
    
    // Result classes
    
    /**
     * Drought analysis guidance for delta pattern selection.
     */
    public static class DroughtGuidance {
        private final String priorityTier;
        private final double droughtWeight;
        private final NumberRangePreferences rangePreferences;
        private final Map<String, Double> patternAdjustments;
        private final List<Integer> preferredStartingNumbers;
        private final List<String> recommendations;
        
        public DroughtGuidance(String priorityTier, double droughtWeight, NumberRangePreferences rangePreferences,
                              Map<String, Double> patternAdjustments, List<Integer> preferredStartingNumbers,
                              List<String> recommendations) {
            this.priorityTier = priorityTier;
            this.droughtWeight = droughtWeight;
            this.rangePreferences = rangePreferences;
            this.patternAdjustments = patternAdjustments;
            this.preferredStartingNumbers = preferredStartingNumbers;
            this.recommendations = recommendations;
        }
        
        public static DroughtGuidance neutral() {
            return new DroughtGuidance(null, 0.0, NumberRangePreferences.neutral(), 
                                     new HashMap<>(), new ArrayList<>(), new ArrayList<>());
        }
        
        public boolean isNeutral() { return priorityTier == null || droughtWeight == 0.0; }
        public String getPriorityTier() { return priorityTier; }
        public double getDroughtWeight() { return droughtWeight; }
        public NumberRangePreferences getRangePreferences() { return rangePreferences; }
        public Map<String, Double> getPatternAdjustments() { return patternAdjustments; }
        public List<Integer> getPreferredStartingNumbers() { return preferredStartingNumbers; }
        public List<String> getRecommendations() { return recommendations; }
    }
    
    /**
     * Number range preferences based on drought analysis.
     */
    public static class NumberRangePreferences {
        private final double lowRangeWeight;
        private final double midRangeWeight;
        private final double highRangeWeight;
        private final int lowEnd;
        private final int highStart;
        
        public NumberRangePreferences(double lowRangeWeight, double midRangeWeight, double highRangeWeight,
                                    int lowEnd, int highStart) {
            this.lowRangeWeight = lowRangeWeight;
            this.midRangeWeight = midRangeWeight;
            this.highRangeWeight = highRangeWeight;
            this.lowEnd = lowEnd;
            this.highStart = highStart;
        }
        
        public static NumberRangePreferences neutral() {
            return new NumberRangePreferences(1.0, 1.0, 1.0, 15, 30);
        }
        
        public double getLowRangeWeight() { return lowRangeWeight; }
        public double getMidRangeWeight() { return midRangeWeight; }
        public double getHighRangeWeight() { return highRangeWeight; }
        public int getLowEnd() { return lowEnd; }
        public int getHighStart() { return highStart; }
    }
    
    /**
     * Delta pattern with drought-informed weighting.
     */
    public static class WeightedDeltaPattern {
        private final int[] pattern;
        private final double finalWeight;
        private final double droughtAdjustment;
        
        public WeightedDeltaPattern(int[] pattern, double finalWeight, double droughtAdjustment) {
            this.pattern = pattern;
            this.finalWeight = finalWeight;
            this.droughtAdjustment = droughtAdjustment;
        }
        
        public int[] getPattern() { return pattern; }
        public double getFinalWeight() { return finalWeight; }
        public double getDroughtAdjustment() { return droughtAdjustment; }
        
        @Override
        public String toString() {
            return String.format("WeightedPattern{%s, weight=%.1f, drought=%.1f}",
                Arrays.toString(pattern), finalWeight, droughtAdjustment);
        }
    }
}