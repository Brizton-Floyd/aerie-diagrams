package com.floyd.lottoptions.legacy.desktop.generation.delta;

import com.floyd.lottoptions.legacy.desktop.generation.advanced.DroughtInformationService;
import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeDroughtAnalysis;
import com.floyd.lottoptions.legacy.desktop.tier.TierOptimizationManager;
import com.floyd.lottoptions.legacy.desktop.quality.UserTargetingRequest;
import com.floyd.persistence.model.LotteryGame;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Strategic Delta Generator that combines the proven delta algorithm with
 * drought intelligence and tier performance optimization.
 * 
 * This generator maintains the mathematical integrity of the delta approach while
 * leveraging strategic intelligence to enhance pattern selection and improve
 * targeting for specific prize tiers and drought conditions.
 */
public class StrategicDeltaGenerator {
    
    private final LotteryGame lotteryGame;
    private final DeltaPureEngine deltaPureEngine;
    private final DeltaDroughtAnalyzer droughtAnalyzer;
    private final DeltaTierOptimizer tierOptimizer;
    // DroughtInformationService is used as static utility class
    
    /**
     * Creates a strategic delta generator with all intelligence components.
     * 
     * @param lotteryGame The lottery game configuration
     * @param tierOptimizationManager Tier optimization manager for historical data
     */
    public StrategicDeltaGenerator(LotteryGame lotteryGame, 
                                   TierOptimizationManager tierOptimizationManager) {
        this.lotteryGame = lotteryGame;
        this.deltaPureEngine = new DeltaPureEngine(lotteryGame);
        this.droughtAnalyzer = new DeltaDroughtAnalyzer(lotteryGame);
        this.tierOptimizer = new DeltaTierOptimizer(lotteryGame, tierOptimizationManager);
    }
    
    /**
     * Generates lottery tickets using strategic delta approach.
     * 
     * @param request User targeting request with preferences
     * @return CompletableFuture containing strategic delta generation results
     */
    public CompletableFuture<StrategicDeltaResult> generateStrategicTickets(UserTargetingRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Step 1: Analyze strategic context
                StrategicContext context = analyzeStrategicContext(request).join();
                
                // Step 2: Generate base delta patterns using pure algorithm
                List<int[]> basePatterns = generateBaseDeltaPatterns(request, context);
                
                // Step 3: Apply strategic intelligence to enhance patterns
                List<int[]> enhancedPatterns = applyStrategicIntelligence(basePatterns, context);
                
                // Step 4: Generate final lottery tickets
                List<int[]> lotteryTickets = generateLotteryTickets(enhancedPatterns, request);
                
                // Step 5: Evaluate and validate results
                StrategicEvaluation evaluation = evaluateStrategicResults(lotteryTickets, context, request);
                
                // Step 6: Build comprehensive result
                return buildStrategicResult(lotteryTickets, context, evaluation, request);
                
            } catch (Exception e) {
                System.err.println("Error in strategic delta generation: " + e.getMessage());
                e.printStackTrace();
                
                // Fallback to pure delta generation
                return fallbackToPureGeneration(request);
            }
        });
    }
    
    /**
     * Creates strategic pattern variations based on intelligence analysis.
     * 
     * @param basePattern Original delta pattern
     * @param context Strategic context
     * @param variationCount Number of variations to create
     * @return List of strategically enhanced pattern variations
     */
    public List<int[]> createStrategicVariations(int[] basePattern, StrategicContext context, int variationCount) {
        List<int[]> variations = new ArrayList<>();
        
        if (context.hasActiveStrategies()) {
            int droughtVariations = variationCount / 3;
            int tierVariations = variationCount / 3;
            int combinedVariations = variationCount - droughtVariations - tierVariations;
            
            // Create drought-informed variations
            if (context.getDroughtGuidance() != null && !context.getDroughtGuidance().isNeutral()) {
                variations.addAll(droughtAnalyzer.createDroughtInformedVariations(
                    basePattern, context.getDroughtGuidance(), droughtVariations));
            }
            
            // Create tier-optimized variations
            if (context.getTierGuidance() != null && !context.getTierGuidance().isNeutral()) {
                variations.addAll(tierOptimizer.createTierOptimizedVariations(
                    basePattern, context.getTierGuidance(), tierVariations));
            }
            
            // Create combined strategic variations
            variations.addAll(createCombinedStrategicVariations(
                basePattern, context, combinedVariations));
        }
        
        return variations.stream().limit(variationCount).collect(Collectors.toList());
    }
    
    /**
     * Evaluates the strategic performance of generated patterns.
     * 
     * @param patterns Generated delta patterns
     * @param context Strategic context
     * @return Strategic performance evaluation
     */
    public StrategicPerformanceEvaluation evaluateStrategicPerformance(List<int[]> patterns, StrategicContext context) {
        double droughtAlignment = 0.0;
        double tierAlignment = 0.0;
        double overallStrategicScore = 0.0;
        List<String> insights = new ArrayList<>();
        
        if (context.hasActiveStrategies()) {
            // Evaluate drought alignment
            if (context.getDroughtGuidance() != null && !context.getDroughtGuidance().isNeutral()) {
                droughtAlignment = evaluateDroughtAlignment(patterns, context.getDroughtGuidance());
                insights.add("Drought alignment score: " + String.format("%.2f", droughtAlignment));
            }
            
            // Evaluate tier alignment
            if (context.getTierGuidance() != null && !context.getTierGuidance().isNeutral()) {
                tierAlignment = evaluateTierAlignment(patterns, context.getTierGuidance());
                insights.add("Tier alignment score: " + String.format("%.2f", tierAlignment));
            }
            
            // Calculate overall strategic score
            overallStrategicScore = calculateOverallStrategicScore(droughtAlignment, tierAlignment, context);
            insights.add("Overall strategic score: " + String.format("%.2f", overallStrategicScore));
        }
        
        return new StrategicPerformanceEvaluation(
            droughtAlignment,
            tierAlignment,
            overallStrategicScore,
            insights
        );
    }
    
    // Private implementation methods
    
    private CompletableFuture<StrategicContext> analyzeStrategicContext(UserTargetingRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Analyze drought conditions if available
                CompletableFuture<DeltaDroughtAnalyzer.DroughtGuidance> droughtFuture = analyzeDroughtConditions(request);
                
                // Analyze tier requirements if specified
                CompletableFuture<DeltaTierOptimizer.TierGuidance> tierFuture = analyzeTierRequirements(request);
                
                // Wait for both analyses to complete
                CompletableFuture.allOf(droughtFuture, tierFuture).join();
                
                DeltaDroughtAnalyzer.DroughtGuidance droughtGuidance = droughtFuture.join();
                DeltaTierOptimizer.TierGuidance tierGuidance = tierFuture.join();
                
                return new StrategicContext(
                    droughtGuidance,
                    tierGuidance,
                    determineStrategicPriority(droughtGuidance, tierGuidance, request),
                    calculateStrategicWeight(droughtGuidance, tierGuidance),
                    generateStrategicRecommendations(droughtGuidance, tierGuidance, request)
                );
                
            } catch (Exception e) {
                System.err.println("Error analyzing strategic context: " + e.getMessage());
                return StrategicContext.neutral();
            }
        });
    }
    
    private CompletableFuture<DeltaDroughtAnalyzer.DroughtGuidance> analyzeDroughtConditions(UserTargetingRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Get drought analysis using static service method
                // For now, return neutral guidance until proper drought analysis integration
                return DeltaDroughtAnalyzer.DroughtGuidance.neutral();
                
            } catch (Exception e) {
                System.err.println("Error analyzing drought conditions: " + e.getMessage());
                return DeltaDroughtAnalyzer.DroughtGuidance.neutral();
            }
        });
    }
    
    private CompletableFuture<DeltaTierOptimizer.TierGuidance> analyzeTierRequirements(UserTargetingRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String targetTier = extractTargetTier(request);
                if (targetTier != null && !targetTier.trim().isEmpty()) {
                    return tierOptimizer.analyzeTierRequirements(targetTier);
                }
                return DeltaTierOptimizer.TierGuidance.neutral();
                
            } catch (Exception e) {
                System.err.println("Error analyzing tier requirements: " + e.getMessage());
                return DeltaTierOptimizer.TierGuidance.neutral();
            }
        });
    }
    
    private List<int[]> generateBaseDeltaPatterns(UserTargetingRequest request, StrategicContext context) {
        // Use pure delta engine to generate base patterns
        DeltaPureEngine.DeltaGenerationResult pureResult = deltaPureEngine.generatePureDeltaTickets(request);
        
        if (pureResult.isSuccessful()) {
            // Extract delta patterns from pure generation result
            return pureResult.getTickets().stream()
                .map(this::convertToDeltaPattern)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        }
        
        return new ArrayList<>();
    }
    
    private List<int[]> applyStrategicIntelligence(List<int[]> basePatterns, StrategicContext context) {
        if (!context.hasActiveStrategies()) {
            return basePatterns; // No strategic enhancement needed
        }
        
        List<int[]> enhancedPatterns = new ArrayList<>();
        
        // Apply drought intelligence if available
        if (context.getDroughtGuidance() != null && !context.getDroughtGuidance().isNeutral()) {
            List<DeltaDroughtAnalyzer.WeightedDeltaPattern> droughtWeighted = 
                droughtAnalyzer.applyDroughtGuidance(basePatterns, context.getDroughtGuidance());
            
            // Extract top drought-informed patterns
            enhancedPatterns.addAll(droughtWeighted.stream()
                .limit(basePatterns.size() / 2)
                .map(DeltaDroughtAnalyzer.WeightedDeltaPattern::getPattern)
                .collect(Collectors.toList()));
        }
        
        // Apply tier optimization if available
        if (context.getTierGuidance() != null && !context.getTierGuidance().isNeutral()) {
            List<DeltaTierOptimizer.TierWeightedDeltaPattern> tierWeighted = 
                tierOptimizer.applyTierOptimization(basePatterns, context.getTierGuidance());
            
            // Extract top tier-optimized patterns
            enhancedPatterns.addAll(tierWeighted.stream()
                .limit(basePatterns.size() / 2)
                .map(DeltaTierOptimizer.TierWeightedDeltaPattern::getPattern)
                .collect(Collectors.toList()));
        }
        
        // If no strategic patterns were generated, fall back to base patterns
        if (enhancedPatterns.isEmpty()) {
            enhancedPatterns.addAll(basePatterns);
        }
        
        // Remove duplicates while preserving order
        return enhancedPatterns.stream()
            .distinct()
            .collect(Collectors.toList());
    }
    
    private List<int[]> generateLotteryTickets(List<int[]> enhancedPatterns, UserTargetingRequest request) {
        List<int[]> tickets = new ArrayList<>();
        DeltaScalingCalculator scalingCalculator = new DeltaScalingCalculator(lotteryGame);
        
        for (int[] pattern : enhancedPatterns) {
            int[] lotteryNumbers = scalingCalculator.deltaPatternToLotteryNumbers(pattern);
            if (lotteryNumbers != null) {
                tickets.add(lotteryNumbers);
            }
            
            // Stop when we have enough tickets
            if (tickets.size() >= request.getTicketCount()) {
                break;
            }
        }
        
        // If we don't have enough tickets, generate more variations
        while (tickets.size() < request.getTicketCount() && !enhancedPatterns.isEmpty()) {
            int[] basePattern = enhancedPatterns.get(tickets.size() % enhancedPatterns.size());
            int[] variation = createSimpleVariation(basePattern, tickets.size());
            int[] lotteryNumbers = scalingCalculator.deltaPatternToLotteryNumbers(variation);
            if (lotteryNumbers != null) {
                tickets.add(lotteryNumbers);
            }
        }
        
        return tickets;
    }
    
    private StrategicEvaluation evaluateStrategicResults(List<int[]> tickets, StrategicContext context, UserTargetingRequest request) {
        // Evaluate using pure delta validation
        DeltaValidationEngine validationEngine = new DeltaValidationEngine(lotteryGame);
        
        // Convert tickets to the required Map format for validation
        Map<int[], int[]> ticketsWithPatterns = new HashMap<>();
        for (int[] ticket : tickets) {
            int[] deltaPattern = convertToDeltaPattern(ticket);
            ticketsWithPatterns.put(ticket, deltaPattern);
        }
        
        DeltaValidationEngine.DeltaBatchValidationResult validation = validationEngine.validateTicketBatch(ticketsWithPatterns);
        
        // Add strategic performance evaluation
        StrategicPerformanceEvaluation strategicPerf = evaluateStrategicPerformance(
            tickets.stream().map(this::convertToDeltaPattern).filter(Objects::nonNull).collect(Collectors.toList()),
            context
        );
        
        return new StrategicEvaluation(validation, strategicPerf, context);
    }
    
    private StrategicDeltaResult buildStrategicResult(List<int[]> tickets, StrategicContext context, 
                                                     StrategicEvaluation evaluation, UserTargetingRequest request) {
        return new StrategicDeltaResult(
            tickets,
            context,
            evaluation,
            generateResultSummary(tickets, context, evaluation),
            generateActionableInsights(context, evaluation, request)
        );
    }
    
    private StrategicDeltaResult fallbackToPureGeneration(UserTargetingRequest request) {
        // Generate using pure delta as fallback
        DeltaPureEngine.DeltaGenerationResult pureResult = deltaPureEngine.generatePureDeltaTickets(request);
        
        if (pureResult.isSuccessful()) {
            return new StrategicDeltaResult(
                pureResult.getTickets(),
                StrategicContext.neutral(),
                new StrategicEvaluation(pureResult.getValidation(), 
                                       new StrategicPerformanceEvaluation(0.0, 0.0, 0.5, 
                                                                         Arrays.asList("Fallback to pure delta generation")),
                                       StrategicContext.neutral()),
                "Fallback generation completed",
                Arrays.asList("Strategic analysis failed - using pure delta algorithm")
            );
        } else {
            // Return empty result if fallback also fails
            return new StrategicDeltaResult(
                new ArrayList<>(),
                StrategicContext.neutral(),
                new StrategicEvaluation(null, 
                                       new StrategicPerformanceEvaluation(0.0, 0.0, 0.0, 
                                                                         Arrays.asList("Both strategic and pure generation failed")),
                                       StrategicContext.neutral()),
                "Generation failed",
                Arrays.asList("Unable to generate tickets - please check lottery configuration")
            );
        }
    }
    
    // Helper methods for strategic processing
    
    private List<int[]> createCombinedStrategicVariations(int[] basePattern, StrategicContext context, int count) {
        List<int[]> variations = new ArrayList<>();
        DeltaScalingCalculator scalingCalculator = new DeltaScalingCalculator(lotteryGame);
        
        for (int i = 0; i < count; i++) {
            int[] variation = basePattern.clone();
            
            // Apply combined strategic adjustments
            if (context.getStrategicWeight() > 0.7) {
                // High strategic weight - make conservative adjustments
                adjustPatternConservatively(variation, i);
            } else {
                // Lower strategic weight - allow more variation
                adjustPatternAggressively(variation, i);
            }
            
            variations.add(variation);
        }
        
        return variations;
    }
    
    private void adjustPatternConservatively(int[] pattern, int variationIndex) {
        // Small adjustments to maintain pattern integrity
        if (pattern.length > 1) {
            int adjustment = (variationIndex % 2) * 2 - 1; // -1 or 1
            int gapIndex = (variationIndex % (pattern.length - 1)) + 1;
            int[] gapRange = new DeltaScalingCalculator(lotteryGame).getOptimalGapRange();
            
            pattern[gapIndex] = Math.max(gapRange[0], Math.min(gapRange[1], pattern[gapIndex] + adjustment));
        }
    }
    
    private void adjustPatternAggressively(int[] pattern, int variationIndex) {
        // Larger adjustments for more diversity
        if (pattern.length > 1) {
            int adjustment = ((variationIndex % 4) - 1) * 2; // -2, 0, 2, 4
            int gapIndex = (variationIndex % (pattern.length - 1)) + 1;
            int[] gapRange = new DeltaScalingCalculator(lotteryGame).getOptimalGapRange();
            
            pattern[gapIndex] = Math.max(gapRange[0], Math.min(gapRange[1], pattern[gapIndex] + adjustment));
        }
    }
    
    private double evaluateDroughtAlignment(List<int[]> patterns, DeltaDroughtAnalyzer.DroughtGuidance guidance) {
        if (patterns.isEmpty()) return 0.0;
        
        double totalAlignment = 0.0;
        for (int[] pattern : patterns) {
            List<DeltaDroughtAnalyzer.WeightedDeltaPattern> weighted = 
                droughtAnalyzer.applyDroughtGuidance(Arrays.asList(pattern), guidance);
            
            if (!weighted.isEmpty()) {
                totalAlignment += weighted.get(0).getDroughtAdjustment() > 0 ? 1.0 : 0.5;
            }
        }
        
        return totalAlignment / patterns.size();
    }
    
    private double evaluateTierAlignment(List<int[]> patterns, DeltaTierOptimizer.TierGuidance guidance) {
        if (patterns.isEmpty()) return 0.0;
        
        double totalAlignment = 0.0;
        for (int[] pattern : patterns) {
            List<DeltaTierOptimizer.TierWeightedDeltaPattern> weighted = 
                tierOptimizer.applyTierOptimization(Arrays.asList(pattern), guidance);
            
            if (!weighted.isEmpty()) {
                totalAlignment += weighted.get(0).getTierAlignment();
            }
        }
        
        return totalAlignment / patterns.size();
    }
    
    private double calculateOverallStrategicScore(double droughtAlignment, double tierAlignment, StrategicContext context) {
        double baseScore = (droughtAlignment + tierAlignment) / 2.0;
        return baseScore * context.getStrategicWeight();
    }
    
    // Utility methods
    
    private String extractTargetTier(UserTargetingRequest request) {
        // Extract target tier from request (implementation depends on request structure)
        // For now, return null - this would be enhanced based on actual request structure
        return null;
    }
    
    private String extractPatternPreference(UserTargetingRequest request, StrategicContext context) {
        if (context.hasActiveStrategies()) {
            return context.getStrategicPriority().name();
        }
        return "BALANCED";
    }
    
    private double calculateQualityThreshold(UserTargetingRequest request, StrategicContext context) {
        return context.hasActiveStrategies() ? 0.8 : 0.7;
    }
    
    private int[] convertToDeltaPattern(int[] lotteryNumbers) {
        // Convert lottery numbers back to delta pattern (inverse of scaling)
        if (lotteryNumbers == null || lotteryNumbers.length == 0) return null;
        
        int[] deltaPattern = new int[lotteryNumbers.length];
        deltaPattern[0] = lotteryNumbers[0]; // First number is starting point
        
        for (int i = 1; i < lotteryNumbers.length; i++) {
            deltaPattern[i] = lotteryNumbers[i] - lotteryNumbers[i-1]; // Gaps between numbers
        }
        
        return deltaPattern;
    }
    
    private int[] createSimpleVariation(int[] basePattern, int variationSeed) {
        int[] variation = basePattern.clone();
        if (variation.length > 1) {
            int gapIndex = (variationSeed % (variation.length - 1)) + 1;
            variation[gapIndex] = Math.max(1, variation[gapIndex] + (variationSeed % 3) - 1);
        }
        return variation;
    }
    
    private StrategicPriority determineStrategicPriority(DeltaDroughtAnalyzer.DroughtGuidance drought, 
                                                        DeltaTierOptimizer.TierGuidance tier, 
                                                        UserTargetingRequest request) {
        if (drought != null && !drought.isNeutral() && tier != null && !tier.isNeutral()) {
            return StrategicPriority.COMBINED;
        } else if (drought != null && !drought.isNeutral()) {
            return StrategicPriority.DROUGHT_FOCUSED;
        } else if (tier != null && !tier.isNeutral()) {
            return StrategicPriority.TIER_FOCUSED;
        } else {
            return StrategicPriority.BALANCED;
        }
    }
    
    private double calculateStrategicWeight(DeltaDroughtAnalyzer.DroughtGuidance drought, 
                                          DeltaTierOptimizer.TierGuidance tier) {
        double weight = 0.0;
        
        if (drought != null && !drought.isNeutral()) {
            weight += drought.getDroughtWeight() * 0.5;
        }
        
        if (tier != null && !tier.isNeutral()) {
            weight += tier.getTargetSuccessRate() * 0.5;
        }
        
        return Math.min(1.0, weight);
    }
    
    private List<String> generateStrategicRecommendations(DeltaDroughtAnalyzer.DroughtGuidance drought, 
                                                         DeltaTierOptimizer.TierGuidance tier, 
                                                         UserTargetingRequest request) {
        List<String> recommendations = new ArrayList<>();
        
        if (drought != null && !drought.isNeutral()) {
            recommendations.addAll(drought.getRecommendations());
        }
        
        if (tier != null && !tier.isNeutral()) {
            recommendations.addAll(tier.getRecommendations());
        }
        
        if (recommendations.isEmpty()) {
            recommendations.add("Using balanced delta generation approach");
        }
        
        return recommendations;
    }
    
    private String generateResultSummary(List<int[]> tickets, StrategicContext context, StrategicEvaluation evaluation) {
        StringBuilder summary = new StringBuilder();
        summary.append("Generated ").append(tickets.size()).append(" tickets using strategic delta approach. ");
        
        if (context.hasActiveStrategies()) {
            summary.append("Strategic intelligence applied with ")
                   .append(context.getStrategicPriority().name().toLowerCase())
                   .append(" priority. ");
        }
        
        summary.append("Overall quality score: ")
               .append(String.format("%.2f", evaluation.getValidationResult().getBatchStatistics().averageScore));
        
        return summary.toString();
    }
    
    private List<String> generateActionableInsights(StrategicContext context, StrategicEvaluation evaluation, 
                                                   UserTargetingRequest request) {
        List<String> insights = new ArrayList<>();
        
        insights.addAll(context.getRecommendations());
        insights.addAll(evaluation.getStrategicPerformance().getInsights());
        
        if (evaluation.getValidationResult().getBatchStatistics().averageScore > 80.0) {
            insights.add("High-quality patterns generated - excellent mathematical foundation");
        } else if (evaluation.getValidationResult().getBatchStatistics().averageScore < 60.0) {
            insights.add("Consider adjusting parameters for better pattern quality");
        }
        
        return insights;
    }
    
    // Result classes and enums
    
    public enum StrategicPriority {
        DROUGHT_FOCUSED,
        TIER_FOCUSED,
        COMBINED,
        BALANCED
    }
    
    /**
     * Strategic context containing all intelligence analysis results.
     */
    public static class StrategicContext {
        private final DeltaDroughtAnalyzer.DroughtGuidance droughtGuidance;
        private final DeltaTierOptimizer.TierGuidance tierGuidance;
        private final StrategicPriority strategicPriority;
        private final double strategicWeight;
        private final List<String> recommendations;
        
        public StrategicContext(DeltaDroughtAnalyzer.DroughtGuidance droughtGuidance,
                               DeltaTierOptimizer.TierGuidance tierGuidance,
                               StrategicPriority strategicPriority,
                               double strategicWeight,
                               List<String> recommendations) {
            this.droughtGuidance = droughtGuidance;
            this.tierGuidance = tierGuidance;
            this.strategicPriority = strategicPriority;
            this.strategicWeight = strategicWeight;
            this.recommendations = recommendations;
        }
        
        public static StrategicContext neutral() {
            return new StrategicContext(
                DeltaDroughtAnalyzer.DroughtGuidance.neutral(),
                DeltaTierOptimizer.TierGuidance.neutral(),
                StrategicPriority.BALANCED,
                0.0,
                Arrays.asList("No strategic intelligence available")
            );
        }
        
        public boolean hasActiveStrategies() {
            return strategicWeight > 0.0 && strategicPriority != StrategicPriority.BALANCED;
        }
        
        public DeltaDroughtAnalyzer.DroughtGuidance getDroughtGuidance() { return droughtGuidance; }
        public DeltaTierOptimizer.TierGuidance getTierGuidance() { return tierGuidance; }
        public StrategicPriority getStrategicPriority() { return strategicPriority; }
        public double getStrategicWeight() { return strategicWeight; }
        public List<String> getRecommendations() { return recommendations; }
    }
    
    /**
     * Strategic performance evaluation results.
     */
    public static class StrategicPerformanceEvaluation {
        private final double droughtAlignment;
        private final double tierAlignment;
        private final double overallStrategicScore;
        private final List<String> insights;
        
        public StrategicPerformanceEvaluation(double droughtAlignment, double tierAlignment,
                                            double overallStrategicScore, List<String> insights) {
            this.droughtAlignment = droughtAlignment;
            this.tierAlignment = tierAlignment;
            this.overallStrategicScore = overallStrategicScore;
            this.insights = insights;
        }
        
        public double getDroughtAlignment() { return droughtAlignment; }
        public double getTierAlignment() { return tierAlignment; }
        public double getOverallStrategicScore() { return overallStrategicScore; }
        public List<String> getInsights() { return insights; }
    }
    
    /**
     * Combined strategic evaluation results.
     */
    public static class StrategicEvaluation {
        private final DeltaValidationEngine.DeltaBatchValidationResult validationResult;
        private final StrategicPerformanceEvaluation strategicPerformance;
        private final StrategicContext context;
        
        public StrategicEvaluation(DeltaValidationEngine.DeltaBatchValidationResult validationResult,
                                  StrategicPerformanceEvaluation strategicPerformance,
                                  StrategicContext context) {
            this.validationResult = validationResult;
            this.strategicPerformance = strategicPerformance;
            this.context = context;
        }
        
        public DeltaValidationEngine.DeltaBatchValidationResult getValidationResult() { return validationResult; }
        public StrategicPerformanceEvaluation getStrategicPerformance() { return strategicPerformance; }
        public StrategicContext getContext() { return context; }
    }
    
    /**
     * Complete strategic delta generation result.
     */
    public static class StrategicDeltaResult {
        private final List<int[]> generatedTickets;
        private final StrategicContext strategicContext;
        private final StrategicEvaluation evaluation;
        private final String resultSummary;
        private final List<String> actionableInsights;
        
        public StrategicDeltaResult(List<int[]> generatedTickets,
                                   StrategicContext strategicContext,
                                   StrategicEvaluation evaluation,
                                   String resultSummary,
                                   List<String> actionableInsights) {
            this.generatedTickets = generatedTickets;
            this.strategicContext = strategicContext;
            this.evaluation = evaluation;
            this.resultSummary = resultSummary;
            this.actionableInsights = actionableInsights;
        }
        
        public List<int[]> getGeneratedTickets() { return generatedTickets; }
        public StrategicContext getStrategicContext() { return strategicContext; }
        public StrategicEvaluation getEvaluation() { return evaluation; }
        public String getResultSummary() { return resultSummary; }
        public List<String> getActionableInsights() { return actionableInsights; }
    }
}