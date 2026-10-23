package com.floyd.lottoptions.legacy.desktop.generation.delta;

import com.floyd.lottoptions.legacy.desktop.tier.TierOptimizationManager;
import com.floyd.lottoptions.legacy.desktop.tier.TierOptimizationStrategy;
import com.floyd.persistence.model.LotteryGame;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Tier optimizer that enhances delta pattern selection with tier performance intelligence.
 * 
 * This component analyzes historical tier performance data and weights delta patterns
 * based on their likelihood to achieve the target prize tier, while maintaining
 * the mathematical advantages of the delta approach.
 */
public class DeltaTierOptimizer {
    
    private final LotteryGame lotteryGame;
    private final DeltaScalingCalculator scalingCalculator;
    private final DeltaBasePatternLibrary patternLibrary;
    private final TierOptimizationManager tierOptimizationManager;
    
    /**
     * Creates a tier optimizer for delta patterns.
     * 
     * @param lotteryGame The lottery game configuration
     * @param tierOptimizationManager Existing tier optimization manager
     */
    public DeltaTierOptimizer(LotteryGame lotteryGame, TierOptimizationManager tierOptimizationManager) {
        this.lotteryGame = lotteryGame;
        this.scalingCalculator = new DeltaScalingCalculator(lotteryGame);
        this.patternLibrary = new DeltaBasePatternLibrary();
        this.tierOptimizationManager = tierOptimizationManager;
    }
    
    /**
     * Analyzes tier performance requirements for delta pattern optimization.
     * 
     * @param targetTier Target prize tier (e.g., "5-of-6", "4-of-5")
     * @return TierGuidance for pattern selection
     */
    public TierGuidance analyzeTierRequirements(String targetTier) {
        Optional<TierOptimizationStrategy> strategyOpt = tierOptimizationManager.getTierStrategy(targetTier);
        
        if (!strategyOpt.isPresent()) {
            return TierGuidance.neutral();
        }
        
        TierOptimizationStrategy strategy = strategyOpt.get();
        
        // Analyze pattern requirements for this tier
        PatternRequirements patternReqs = analyzePatternRequirements(targetTier, strategy);
        
        // Calculate coverage requirements
        CoverageRequirements coverageReqs = analyzeCoverageRequirements(targetTier, strategy);
        
        // Determine optimal pattern characteristics
        OptimalCharacteristics optimalChars = determineOptimalCharacteristics(targetTier, strategy);
        
        // Generate tier-specific recommendations
        List<String> recommendations = generateTierRecommendations(targetTier, strategy, patternReqs);
        
        return new TierGuidance(
            targetTier,
            strategy.getTierLevel(),
            calculateExpectedSuccessRate(strategy),
            patternReqs,
            coverageReqs,
            optimalChars,
            recommendations
        );
    }
    
    /**
     * Applies tier optimization to prioritize delta patterns for target tier.
     * 
     * @param basePatterns Original delta patterns
     * @param tierGuidance Tier analysis guidance
     * @return Prioritized patterns with tier-informed weighting
     */
    public List<TierWeightedDeltaPattern> applyTierOptimization(List<int[]> basePatterns, TierGuidance tierGuidance) {
        List<TierWeightedDeltaPattern> weightedPatterns = new ArrayList<>();
        
        for (int[] pattern : basePatterns) {
            double baseScore = patternLibrary.getPatternPriorityScore(pattern);
            double tierAdjustment = calculateTierAdjustment(pattern, tierGuidance);
            double finalWeight = baseScore + tierAdjustment;
            double tierAlignment = calculateTierAlignment(pattern, tierGuidance);
            
            weightedPatterns.add(new TierWeightedDeltaPattern(pattern, finalWeight, tierAdjustment, tierAlignment));
        }
        
        // Sort by tier alignment first, then final weight
        weightedPatterns.sort((a, b) -> {
            int alignmentCompare = Double.compare(b.getTierAlignment(), a.getTierAlignment());
            if (alignmentCompare != 0) return alignmentCompare;
            return Double.compare(b.getFinalWeight(), a.getFinalWeight());
        });
        
        return weightedPatterns;
    }
    
    /**
     * Creates tier-optimized pattern variations.
     * 
     * @param basePattern Original pattern
     * @param tierGuidance Tier guidance
     * @param variationCount Number of variations to create
     * @return List of tier-optimized pattern variations
     */
    public List<int[]> createTierOptimizedVariations(int[] basePattern, TierGuidance tierGuidance, int variationCount) {
        List<int[]> variations = new ArrayList<>();
        
        if (tierGuidance.isNeutral()) {
            return variations;
        }
        
        OptimalCharacteristics optimalChars = tierGuidance.getOptimalCharacteristics();
        
        // Create variations optimized for the target tier
        for (int i = 0; i < variationCount; i++) {
            int[] variation = createTierOptimizedVariation(basePattern, optimalChars, i);
            if (variation != null) {
                variations.add(variation);
            }
        }
        
        return variations;
    }
    
    /**
     * Evaluates how well a set of delta patterns covers the target tier requirements.
     * 
     * @param patterns Delta patterns to evaluate
     * @param tierGuidance Tier requirements
     * @return Coverage evaluation result
     */
    public CoverageEvaluation evaluateTierCoverage(List<int[]> patterns, TierGuidance tierGuidance) {
        if (tierGuidance.isNeutral()) {
            return CoverageEvaluation.neutral();
        }
        
        double totalCoverage = 0.0;
        int patternsEvaluated = 0;
        Map<String, Integer> characteristicCounts = new HashMap<>();
        
        for (int[] pattern : patterns) {
            double patternCoverage = calculatePatternTierCoverage(pattern, tierGuidance);
            totalCoverage += patternCoverage;
            patternsEvaluated++;
            
            // Track pattern characteristics
            updateCharacteristicCounts(pattern, characteristicCounts);
        }
        
        double averageCoverage = patternsEvaluated > 0 ? totalCoverage / patternsEvaluated : 0.0;
        double coverageQuality = evaluateCoverageQuality(averageCoverage, tierGuidance.getTargetSuccessRate());
        
        return new CoverageEvaluation(
            averageCoverage,
            coverageQuality,
            patternsEvaluated,
            characteristicCounts,
            generateCoverageRecommendations(averageCoverage, tierGuidance)
        );
    }
    
    // Private implementation methods
    
    private PatternRequirements analyzePatternRequirements(String targetTier, TierOptimizationStrategy strategy) {
        int tierLevel = strategy.getTierLevel();
        
        // Pattern complexity based on tier level
        PatternComplexity complexity;
        if (tierLevel == 1) {
            complexity = PatternComplexity.HIGH; // Jackpot needs precision
        } else if (tierLevel <= 2) {
            complexity = PatternComplexity.MEDIUM_HIGH; // Near-jackpot
        } else if (tierLevel <= 3) {
            complexity = PatternComplexity.MEDIUM; // Secondary prizes
        } else {
            complexity = PatternComplexity.LOW; // Frequent wins
        }
        
        // Balance requirements
        boolean requiresBalance = tierLevel <= 3; // Higher tiers need more balance
        boolean allowsAggressive = tierLevel >= 4; // Lower tiers can be more aggressive
        
        // Pattern type preferences
        List<String> preferredTypes = new ArrayList<>();
        if (tierLevel == 1) {
            preferredTypes.addAll(Arrays.asList("ARITHMETIC", "PRIMARY"));
        } else if (tierLevel <= 2) {
            preferredTypes.addAll(Arrays.asList("PRIMARY", "ARITHMETIC", "SECONDARY"));
        } else {
            preferredTypes.addAll(Arrays.asList("SECONDARY", "COMMON", "ARITHMETIC"));
        }
        
        return new PatternRequirements(complexity, requiresBalance, allowsAggressive, preferredTypes);
    }
    
    private CoverageRequirements analyzeCoverageRequirements(String targetTier, TierOptimizationStrategy strategy) {
        double targetSuccessRate = calculateExpectedSuccessRate(strategy);
        int tierLevel = strategy.getTierLevel();
        
        // Coverage breadth - higher tiers need broader coverage
        double requiredBreadth = Math.max(0.6, 0.9 - (tierLevel * 0.1));
        
        // Coverage depth - precision requirements
        double requiredDepth = tierLevel <= 2 ? 0.8 : 0.6;
        
        // Pattern diversity requirements
        int minPatternTypes = Math.max(2, 5 - tierLevel);
        
        return new CoverageRequirements(targetSuccessRate, requiredBreadth, requiredDepth, minPatternTypes);
    }
    
    private OptimalCharacteristics determineOptimalCharacteristics(String targetTier, TierOptimizationStrategy strategy) {
        int tierLevel = strategy.getTierLevel();
        
        // Spread characteristics
        double optimalSpreadMin, optimalSpreadMax;
        if (tierLevel == 1) {
            // Jackpot - moderate, controlled spread
            optimalSpreadMin = 0.6;
            optimalSpreadMax = 0.8;
        } else if (tierLevel <= 2) {
            // Near-jackpot - balanced spread
            optimalSpreadMin = 0.5;
            optimalSpreadMax = 0.85;
        } else {
            // Secondary prizes - wider spread acceptable
            optimalSpreadMin = 0.4;
            optimalSpreadMax = 0.9;
        }
        
        // Gap characteristics
        GapCharacteristics gapChars;
        if (tierLevel <= 2) {
            gapChars = new GapCharacteristics(0.8, 0.3, true); // Consistent gaps, low variance, arithmetic preferred
        } else {
            gapChars = new GapCharacteristics(0.6, 0.5, false); // More flexible gaps
        }
        
        // Balance requirements
        BalanceRequirements balanceReqs = new BalanceRequirements(
            tierLevel <= 3, // Odd/even balance required
            tierLevel <= 2, // High/low balance required
            tierLevel == 1  // Range distribution required
        );
        
        return new OptimalCharacteristics(optimalSpreadMin, optimalSpreadMax, gapChars, balanceReqs);
    }
    
    private double calculateTierAdjustment(int[] pattern, TierGuidance guidance) {
        if (guidance.isNeutral()) {
            return 0.0;
        }
        
        double adjustment = 0.0;
        
        // Pattern type preference adjustment
        String patternType = determinePatternType(pattern);
        if (guidance.getPatternRequirements().getPreferredTypes().contains(patternType)) {
            adjustment += 5.0 * (guidance.getTierLevel() <= 2 ? 1.5 : 1.0);
        }
        
        // Complexity alignment adjustment
        double complexityScore = calculatePatternComplexity(pattern);
        PatternComplexity requiredComplexity = guidance.getPatternRequirements().getComplexity();
        if (alignsWithComplexity(complexityScore, requiredComplexity)) {
            adjustment += 3.0;
        }
        
        // Optimal characteristics alignment
        adjustment += calculateCharacteristicAlignment(pattern, guidance.getOptimalCharacteristics());
        
        return adjustment;
    }
    
    private double calculateTierAlignment(int[] pattern, TierGuidance guidance) {
        if (guidance.isNeutral()) {
            return 0.5;
        }
        
        double alignment = 0.0;
        int checks = 0;
        
        // Check pattern type alignment
        String patternType = determinePatternType(pattern);
        if (guidance.getPatternRequirements().getPreferredTypes().contains(patternType)) {
            alignment += 1.0;
        }
        checks++;
        
        // Check characteristic alignment
        alignment += calculateCharacteristicAlignmentScore(pattern, guidance.getOptimalCharacteristics());
        checks++;
        
        // Check complexity alignment
        double complexityScore = calculatePatternComplexity(pattern);
        if (alignsWithComplexity(complexityScore, guidance.getPatternRequirements().getComplexity())) {
            alignment += 1.0;
        }
        checks++;
        
        return alignment / checks;
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
    
    private double calculatePatternComplexity(int[] pattern) {
        // Calculate complexity based on gap variance and pattern regularity
        if (pattern.length <= 1) return 0.0;
        
        double[] gaps = new double[pattern.length - 1];
        for (int i = 1; i < pattern.length; i++) {
            gaps[i-1] = pattern[i];
        }
        
        // Calculate variance
        double mean = Arrays.stream(gaps).average().orElse(0.0);
        double variance = Arrays.stream(gaps).map(x -> Math.pow(x - mean, 2)).average().orElse(0.0);
        
        // Lower variance = higher complexity (more precise pattern)
        return Math.max(0.0, 1.0 - (variance / 10.0));
    }
    
    private boolean alignsWithComplexity(double patternComplexity, PatternComplexity requiredComplexity) {
        switch (requiredComplexity) {
            case HIGH: return patternComplexity >= 0.8;
            case MEDIUM_HIGH: return patternComplexity >= 0.6;
            case MEDIUM: return patternComplexity >= 0.4 && patternComplexity <= 0.8;
            case LOW: return patternComplexity <= 0.6;
            default: return true;
        }
    }
    
    private double calculateCharacteristicAlignment(int[] pattern, OptimalCharacteristics optimalChars) {
        // Simulate pattern to check characteristics
        int[] lotteryNumbers = scalingCalculator.deltaPatternToLotteryNumbers(pattern);
        if (lotteryNumbers == null) return 0.0;
        
        double alignment = 0.0;
        int checks = 0;
        
        // Check spread alignment
        double spread = (double)(lotteryNumbers[lotteryNumbers.length-1] - lotteryNumbers[0]) / 
                       (lotteryGame.getMaxNumber() - lotteryGame.getMinNumber());
        if (spread >= optimalChars.getOptimalSpreadMin() && spread <= optimalChars.getOptimalSpreadMax()) {
            alignment += 1.0;
        }
        checks++;
        
        // Check gap consistency
        if (optimalChars.getGapCharacteristics().isConsistencyRequired()) {
            boolean isConsistent = patternLibrary.isArithmeticProgression(pattern);
            if (isConsistent) alignment += 1.0;
            checks++;
        }
        
        return checks > 0 ? alignment / checks : 0.0;
    }
    
    private double calculateCharacteristicAlignmentScore(int[] pattern, OptimalCharacteristics optimalChars) {
        return Math.min(1.0, calculateCharacteristicAlignment(pattern, optimalChars));
    }
    
    private int[] createTierOptimizedVariation(int[] basePattern, OptimalCharacteristics optimalChars, int variationIndex) {
        int[] variation = basePattern.clone();
        
        // Apply tier-specific optimizations
        if (optimalChars.getGapCharacteristics().isArithmeticPreferred() && variationIndex == 0) {
            // Create arithmetic progression variation
            if (variation.length > 1) {
                int avgGap = Arrays.stream(variation, 1, variation.length).sum() / (variation.length - 1);
                for (int i = 1; i < variation.length; i++) {
                    variation[i] = avgGap;
                }
            }
        } else {
            // Create controlled variations within optimal characteristics
            int[] gapRange = scalingCalculator.getOptimalGapRange();
            for (int i = 1; i < variation.length; i++) {
                int adjustment = (variationIndex % 3) - 1; // -1, 0, or 1
                variation[i] = Math.max(gapRange[0], Math.min(gapRange[1], variation[i] + adjustment));
            }
        }
        
        return variation;
    }
    
    private double calculatePatternTierCoverage(int[] pattern, TierGuidance guidance) {
        double coverage = 0.0;
        
        // Base coverage from pattern type alignment
        String patternType = determinePatternType(pattern);
        if (guidance.getPatternRequirements().getPreferredTypes().contains(patternType)) {
            coverage += 0.4;
        }
        
        // Coverage from characteristic alignment
        coverage += calculateCharacteristicAlignment(pattern, guidance.getOptimalCharacteristics()) * 0.4;
        
        // Coverage from tier level appropriateness
        double complexityScore = calculatePatternComplexity(pattern);
        if (alignsWithComplexity(complexityScore, guidance.getPatternRequirements().getComplexity())) {
            coverage += 0.2;
        }
        
        return Math.min(1.0, coverage);
    }
    
    private void updateCharacteristicCounts(int[] pattern, Map<String, Integer> counts) {
        String type = determinePatternType(pattern);
        counts.put(type, counts.getOrDefault(type, 0) + 1);
        
        if (patternLibrary.isArithmeticProgression(pattern)) {
            counts.put("ARITHMETIC_COUNT", counts.getOrDefault("ARITHMETIC_COUNT", 0) + 1);
        }
    }
    
    private double evaluateCoverageQuality(double averageCoverage, double targetSuccessRate) {
        // Quality is how well the coverage aligns with target success rate
        double coverageGap = Math.abs(averageCoverage - targetSuccessRate);
        return Math.max(0.0, 1.0 - (coverageGap * 2.0));
    }
    
    private List<String> generateTierRecommendations(String targetTier, TierOptimizationStrategy strategy, PatternRequirements patternReqs) {
        List<String> recommendations = new ArrayList<>();
        
        recommendations.add("Target tier: " + targetTier + " (Level " + strategy.getTierLevel() + ")");
        
        if (strategy.getTierLevel() <= 2) {
            recommendations.add("Use high-precision patterns (arithmetic progressions recommended)");
        } else {
            recommendations.add("Balanced approach with pattern diversity");
        }
        
        if (patternReqs.isRequiresBalance()) {
            recommendations.add("Maintain balanced number distribution");
        }
        
        if (!patternReqs.getPreferredTypes().isEmpty()) {
            recommendations.add("Focus on pattern types: " + String.join(", ", patternReqs.getPreferredTypes()));
        }
        
        return recommendations;
    }
    
    private List<String> generateCoverageRecommendations(double averageCoverage, TierGuidance guidance) {
        List<String> recommendations = new ArrayList<>();
        
        if (averageCoverage < 0.5) {
            recommendations.add("Increase pattern diversity for better tier coverage");
        } else if (averageCoverage > 0.8) {
            recommendations.add("Excellent tier coverage - maintain current approach");
        }
        
        if (guidance.getTierLevel() <= 2 && averageCoverage < 0.7) {
            recommendations.add("Consider more arithmetic progressions for higher-tier precision");
        }
        
        return recommendations;
    }
    
    // Enums and result classes
    
    public enum PatternComplexity {
        LOW, MEDIUM, MEDIUM_HIGH, HIGH
    }
    
    public static class PatternRequirements {
        private final PatternComplexity complexity;
        private final boolean requiresBalance;
        private final boolean allowsAggressive;
        private final List<String> preferredTypes;
        
        public PatternRequirements(PatternComplexity complexity, boolean requiresBalance, 
                                 boolean allowsAggressive, List<String> preferredTypes) {
            this.complexity = complexity;
            this.requiresBalance = requiresBalance;
            this.allowsAggressive = allowsAggressive;
            this.preferredTypes = preferredTypes;
        }
        
        public PatternComplexity getComplexity() { return complexity; }
        public boolean isRequiresBalance() { return requiresBalance; }
        public boolean isAllowsAggressive() { return allowsAggressive; }
        public List<String> getPreferredTypes() { return preferredTypes; }
    }
    
    public static class CoverageRequirements {
        private final double targetSuccessRate;
        private final double requiredBreadth;
        private final double requiredDepth;
        private final int minPatternTypes;
        
        public CoverageRequirements(double targetSuccessRate, double requiredBreadth, 
                                  double requiredDepth, int minPatternTypes) {
            this.targetSuccessRate = targetSuccessRate;
            this.requiredBreadth = requiredBreadth;
            this.requiredDepth = requiredDepth;
            this.minPatternTypes = minPatternTypes;
        }
        
        public double getTargetSuccessRate() { return targetSuccessRate; }
        public double getRequiredBreadth() { return requiredBreadth; }
        public double getRequiredDepth() { return requiredDepth; }
        public int getMinPatternTypes() { return minPatternTypes; }
    }
    
    public static class GapCharacteristics {
        private final double consistencyRequired;
        private final double maxVariance;
        private final boolean arithmeticPreferred;
        
        public GapCharacteristics(double consistencyRequired, double maxVariance, boolean arithmeticPreferred) {
            this.consistencyRequired = consistencyRequired;
            this.maxVariance = maxVariance;
            this.arithmeticPreferred = arithmeticPreferred;
        }
        
        public double getConsistencyRequired() { return consistencyRequired; }
        public double getMaxVariance() { return maxVariance; }
        public boolean isConsistencyRequired() { return consistencyRequired > 0.7; }
        public boolean isArithmeticPreferred() { return arithmeticPreferred; }
    }
    
    public static class BalanceRequirements {
        private final boolean oddEvenRequired;
        private final boolean highLowRequired;
        private final boolean rangeDistributionRequired;
        
        public BalanceRequirements(boolean oddEvenRequired, boolean highLowRequired, boolean rangeDistributionRequired) {
            this.oddEvenRequired = oddEvenRequired;
            this.highLowRequired = highLowRequired;
            this.rangeDistributionRequired = rangeDistributionRequired;
        }
        
        public boolean isOddEvenRequired() { return oddEvenRequired; }
        public boolean isHighLowRequired() { return highLowRequired; }
        public boolean isRangeDistributionRequired() { return rangeDistributionRequired; }
    }
    
    public static class OptimalCharacteristics {
        private final double optimalSpreadMin;
        private final double optimalSpreadMax;
        private final GapCharacteristics gapCharacteristics;
        private final BalanceRequirements balanceRequirements;
        
        public OptimalCharacteristics(double optimalSpreadMin, double optimalSpreadMax,
                                    GapCharacteristics gapCharacteristics, BalanceRequirements balanceRequirements) {
            this.optimalSpreadMin = optimalSpreadMin;
            this.optimalSpreadMax = optimalSpreadMax;
            this.gapCharacteristics = gapCharacteristics;
            this.balanceRequirements = balanceRequirements;
        }
        
        public double getOptimalSpreadMin() { return optimalSpreadMin; }
        public double getOptimalSpreadMax() { return optimalSpreadMax; }
        public GapCharacteristics getGapCharacteristics() { return gapCharacteristics; }
        public BalanceRequirements getBalanceRequirements() { return balanceRequirements; }
    }
    
    public static class TierGuidance {
        private final String targetTier;
        private final int tierLevel;
        private final double targetSuccessRate;
        private final PatternRequirements patternRequirements;
        private final CoverageRequirements coverageRequirements;
        private final OptimalCharacteristics optimalCharacteristics;
        private final List<String> recommendations;
        
        public TierGuidance(String targetTier, int tierLevel, double targetSuccessRate,
                          PatternRequirements patternRequirements, CoverageRequirements coverageRequirements,
                          OptimalCharacteristics optimalCharacteristics, List<String> recommendations) {
            this.targetTier = targetTier;
            this.tierLevel = tierLevel;
            this.targetSuccessRate = targetSuccessRate;
            this.patternRequirements = patternRequirements;
            this.coverageRequirements = coverageRequirements;
            this.optimalCharacteristics = optimalCharacteristics;
            this.recommendations = recommendations;
        }
        
        public static TierGuidance neutral() {
            return new TierGuidance(null, 0, 0.0, 
                                  new PatternRequirements(PatternComplexity.MEDIUM, false, true, new ArrayList<>()),
                                  new CoverageRequirements(0.5, 0.5, 0.5, 1),
                                  new OptimalCharacteristics(0.4, 0.9, 
                                                            new GapCharacteristics(0.5, 0.5, false),
                                                            new BalanceRequirements(false, false, false)),
                                  new ArrayList<>());
        }
        
        public boolean isNeutral() { return targetTier == null; }
        public String getTargetTier() { return targetTier; }
        public int getTierLevel() { return tierLevel; }
        public double getTargetSuccessRate() { return targetSuccessRate; }
        public PatternRequirements getPatternRequirements() { return patternRequirements; }
        public CoverageRequirements getCoverageRequirements() { return coverageRequirements; }
        public OptimalCharacteristics getOptimalCharacteristics() { return optimalCharacteristics; }
        public List<String> getRecommendations() { return recommendations; }
    }
    
    public static class TierWeightedDeltaPattern {
        private final int[] pattern;
        private final double finalWeight;
        private final double tierAdjustment;
        private final double tierAlignment;
        
        public TierWeightedDeltaPattern(int[] pattern, double finalWeight, double tierAdjustment, double tierAlignment) {
            this.pattern = pattern;
            this.finalWeight = finalWeight;
            this.tierAdjustment = tierAdjustment;
            this.tierAlignment = tierAlignment;
        }
        
        public int[] getPattern() { return pattern; }
        public double getFinalWeight() { return finalWeight; }
        public double getTierAdjustment() { return tierAdjustment; }
        public double getTierAlignment() { return tierAlignment; }
        
        @Override
        public String toString() {
            return String.format("TierWeightedPattern{%s, weight=%.1f, tier=%.1f, align=%.2f}",
                Arrays.toString(pattern), finalWeight, tierAdjustment, tierAlignment);
        }
    }
    
    public static class CoverageEvaluation {
        private final double averageCoverage;
        private final double coverageQuality;
        private final int patternsEvaluated;
        private final Map<String, Integer> characteristicCounts;
        private final List<String> recommendations;
        
        public CoverageEvaluation(double averageCoverage, double coverageQuality, int patternsEvaluated,
                                Map<String, Integer> characteristicCounts, List<String> recommendations) {
            this.averageCoverage = averageCoverage;
            this.coverageQuality = coverageQuality;
            this.patternsEvaluated = patternsEvaluated;
            this.characteristicCounts = characteristicCounts;
            this.recommendations = recommendations;
        }
        
        public static CoverageEvaluation neutral() {
            return new CoverageEvaluation(0.5, 0.5, 0, new HashMap<>(), new ArrayList<>());
        }
        
        public double getAverageCoverage() { return averageCoverage; }
        public double getCoverageQuality() { return coverageQuality; }
        public int getPatternsEvaluated() { return patternsEvaluated; }
        public Map<String, Integer> getCharacteristicCounts() { return characteristicCounts; }
        public List<String> getRecommendations() { return recommendations; }
    }
    
    /**
     * Calculates expected success rate based on tier level and priority.
     * Since TierOptimizationStrategy doesn't have getTargetSuccessRate(), 
     * we calculate it based on available information.
     */
    private double calculateExpectedSuccessRate(TierOptimizationStrategy strategy) {
        int tierLevel = strategy.getTierLevel();
        int priority = strategy.getPriority();
        int requiredMatches = strategy.getRequiredMatches();
        
        // Base success rate decreases as required matches increase (higher tiers are harder)
        double baseRate = Math.max(0.1, 1.0 - (requiredMatches * 0.15));
        
        // Adjust based on priority (higher priority gets slight boost)
        double priorityBonus = (priority / 10.0) * 0.1;
        
        return Math.min(0.95, baseRate + priorityBonus);
    }
}