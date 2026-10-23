package com.floyd.lottoptions.legacy.desktop.generation.delta;

import com.floyd.lottoptions.legacy.desktop.generation.delta.DeltaValidationEngine;

import java.util.List;
import java.util.Map;

/**
 * Comprehensive delta analysis result for generated lottery tickets.
 * Contains all delta-specific information including pattern analysis,
 * strategic intelligence insights, and performance evaluations.
 */
public class DeltaAnalysisResult {
    
    private final String deltaStrategy; // DELTA_PURE, DELTA_STRATEGIC, DELTA_HYBRID
    private final DeltaValidationEngine.DeltaBatchValidationResult deltaValidation;
    private final StrategicDeltaGenerator.StrategicContext strategicContext;
    private final StrategicDeltaGenerator.StrategicPerformanceEvaluation strategicPerformance;
    private final DeltaPatternAnalysis patternAnalysis;
    private final List<String> recommendations;
    private final Map<String, Object> additionalMetrics;
    private final double deltaEfficiencyScore;
    private final boolean strategicIntelligenceApplied;
    
    /**
     * Creates a delta analysis result with all components.
     * 
     * @param deltaStrategy The delta strategy used (DELTA_PURE, DELTA_STRATEGIC, DELTA_HYBRID)
     * @param deltaValidation Delta-specific validation results
     * @param strategicContext Strategic context if strategic intelligence was used
     * @param strategicPerformance Strategic performance evaluation
     * @param patternAnalysis Pattern analysis results
     * @param recommendations List of actionable recommendations
     * @param additionalMetrics Additional metrics for analysis
     * @param deltaEfficiencyScore Overall delta efficiency score (0-1)
     * @param strategicIntelligenceApplied Whether strategic intelligence was applied
     */
    public DeltaAnalysisResult(String deltaStrategy,
                              DeltaValidationEngine.DeltaBatchValidationResult deltaValidation,
                              StrategicDeltaGenerator.StrategicContext strategicContext,
                              StrategicDeltaGenerator.StrategicPerformanceEvaluation strategicPerformance,
                              DeltaPatternAnalysis patternAnalysis,
                              List<String> recommendations,
                              Map<String, Object> additionalMetrics,
                              double deltaEfficiencyScore,
                              boolean strategicIntelligenceApplied) {
        this.deltaStrategy = deltaStrategy;
        this.deltaValidation = deltaValidation;
        this.strategicContext = strategicContext;
        this.strategicPerformance = strategicPerformance;
        this.patternAnalysis = patternAnalysis;
        this.recommendations = recommendations;
        this.additionalMetrics = additionalMetrics;
        this.deltaEfficiencyScore = deltaEfficiencyScore;
        this.strategicIntelligenceApplied = strategicIntelligenceApplied;
    }
    
    /**
     * Creates a simple delta analysis result for pure delta generation.
     * 
     * @param deltaValidation Delta validation results
     * @param patternAnalysis Pattern analysis results
     * @param recommendations Recommendations list
     * @return DeltaAnalysisResult for pure delta generation
     */
    public static DeltaAnalysisResult forPureDelta(DeltaValidationEngine.DeltaBatchValidationResult deltaValidation,
                                                  DeltaPatternAnalysis patternAnalysis,
                                                  List<String> recommendations) {
        return new DeltaAnalysisResult(
            "DELTA_PURE",
            deltaValidation,
            null, // No strategic context for pure delta
            null, // No strategic performance for pure delta
            patternAnalysis,
            recommendations,
            Map.of("pureGeneration", true),
            deltaValidation != null ? deltaValidation.getBatchStatistics().averageScore : 0.0,
            false // No strategic intelligence for pure delta
        );
    }
    
    /**
     * Creates a strategic delta analysis result.
     * 
     * @param deltaValidation Delta validation results
     * @param strategicContext Strategic context used
     * @param strategicPerformance Strategic performance evaluation
     * @param patternAnalysis Pattern analysis results
     * @param recommendations Recommendations list
     * @return DeltaAnalysisResult for strategic delta generation
     */
    public static DeltaAnalysisResult forStrategicDelta(DeltaValidationEngine.DeltaBatchValidationResult deltaValidation,
                                                       StrategicDeltaGenerator.StrategicContext strategicContext,
                                                       StrategicDeltaGenerator.StrategicPerformanceEvaluation strategicPerformance,
                                                       DeltaPatternAnalysis patternAnalysis,
                                                       List<String> recommendations) {
        double efficiencyScore = calculateStrategicEfficiencyScore(deltaValidation, strategicPerformance);
        
        return new DeltaAnalysisResult(
            "DELTA_STRATEGIC",
            deltaValidation,
            strategicContext,
            strategicPerformance,
            patternAnalysis,
            recommendations,
            Map.of(
                "strategicGeneration", true,
                "droughtAlignment", strategicPerformance != null ? strategicPerformance.getDroughtAlignment() : 0.0,
                "tierAlignment", strategicPerformance != null ? strategicPerformance.getTierAlignment() : 0.0,
                "strategicScore", strategicPerformance != null ? strategicPerformance.getOverallStrategicScore() : 0.0
            ),
            efficiencyScore,
            true // Strategic intelligence was applied
        );
    }
    
    /**
     * Gets the delta strategy that was used.
     * 
     * @return Strategy name (DELTA_PURE, DELTA_STRATEGIC, DELTA_HYBRID)
     */
    public String getDeltaStrategy() {
        return deltaStrategy;
    }
    
    /**
     * Gets the delta validation results.
     * 
     * @return Validation results including quality scores and pattern analysis
     */
    public DeltaValidationEngine.DeltaBatchValidationResult getDeltaValidation() {
        return deltaValidation;
    }
    
    /**
     * Gets the strategic context if strategic intelligence was used.
     * 
     * @return Strategic context, or null if not applicable
     */
    public StrategicDeltaGenerator.StrategicContext getStrategicContext() {
        return strategicContext;
    }
    
    /**
     * Gets the strategic performance evaluation if strategic intelligence was used.
     * 
     * @return Strategic performance evaluation, or null if not applicable
     */
    public StrategicDeltaGenerator.StrategicPerformanceEvaluation getStrategicPerformance() {
        return strategicPerformance;
    }
    
    /**
     * Gets the pattern analysis results.
     * 
     * @return Pattern analysis including pattern distribution and characteristics
     */
    public DeltaPatternAnalysis getPatternAnalysis() {
        return patternAnalysis;
    }
    
    /**
     * Gets the list of recommendations.
     * 
     * @return List of actionable recommendations for the user
     */
    public List<String> getRecommendations() {
        return recommendations;
    }
    
    /**
     * Gets additional metrics and analysis data.
     * 
     * @return Map of additional metrics for extended analysis
     */
    public Map<String, Object> getAdditionalMetrics() {
        return additionalMetrics;
    }
    
    /**
     * Gets the overall delta efficiency score.
     * 
     * @return Efficiency score (0-1) representing delta algorithm performance
     */
    public double getDeltaEfficiencyScore() {
        return deltaEfficiencyScore;
    }
    
    /**
     * Gets whether strategic intelligence was applied.
     * 
     * @return true if drought/tier intelligence was used
     */
    public boolean isStrategicIntelligenceApplied() {
        return strategicIntelligenceApplied;
    }
    
    /**
     * Gets a human-readable summary of the delta analysis.
     * 
     * @return Summary string for UI display
     */
    public String getSummary() {
        StringBuilder summary = new StringBuilder();
        
        summary.append("Delta Strategy: ").append(deltaStrategy);
        
        if (deltaValidation != null) {
            summary.append(" | Quality: ").append(String.format("%.1f", deltaValidation.getBatchStatistics().averageScore));
        }
        
        if (strategicIntelligenceApplied && strategicPerformance != null) {
            summary.append(" | Strategic Score: ").append(String.format("%.2f", strategicPerformance.getOverallStrategicScore()));
        }
        
        summary.append(" | Efficiency: ").append(String.format("%.2f", deltaEfficiencyScore));
        
        return summary.toString();
    }
    
    /**
     * Checks if the delta generation was successful.
     * 
     * @return true if delta analysis indicates successful generation
     */
    public boolean isSuccessful() {
        return deltaValidation != null && deltaValidation.getBatchStatistics().averageScore > 0.5 && 
               deltaEfficiencyScore > 0.5;
    }
    
    /**
     * Gets the strategic intelligence insights if available.
     * 
     * @return List of strategic insights, or empty list if not applicable
     */
    public List<String> getStrategicInsights() {
        if (strategicPerformance != null) {
            return strategicPerformance.getInsights();
        }
        return List.of();
    }
    
    // Private helper methods
    
    private static double calculateStrategicEfficiencyScore(DeltaValidationEngine.DeltaBatchValidationResult deltaValidation,
                                                           StrategicDeltaGenerator.StrategicPerformanceEvaluation strategicPerformance) {
        double baseScore = deltaValidation != null ? deltaValidation.getBatchStatistics().averageScore : 0.0;
        
        if (strategicPerformance != null) {
            double strategicBonus = strategicPerformance.getOverallStrategicScore() * 0.2; // 20% bonus from strategic intelligence
            return Math.min(1.0, baseScore + strategicBonus);
        }
        
        return baseScore;
    }
    
    /**
     * Pattern analysis results for delta generation.
     */
    public static class DeltaPatternAnalysis {
        private final int totalPatterns;
        private final Map<String, Integer> patternTypeDistribution;
        private final int arithmeticProgressions;
        private final double averageGapSize;
        private final double gapVariance;
        private final List<String> patternCharacteristics;
        
        /**
         * Creates a pattern analysis result.
         * 
         * @param totalPatterns Total number of patterns analyzed
         * @param patternTypeDistribution Distribution of pattern types
         * @param arithmeticProgressions Number of arithmetic progressions found
         * @param averageGapSize Average gap size across patterns
         * @param gapVariance Variance in gap sizes
         * @param patternCharacteristics List of pattern characteristics identified
         */
        public DeltaPatternAnalysis(int totalPatterns,
                                   Map<String, Integer> patternTypeDistribution,
                                   int arithmeticProgressions,
                                   double averageGapSize,
                                   double gapVariance,
                                   List<String> patternCharacteristics) {
            this.totalPatterns = totalPatterns;
            this.patternTypeDistribution = patternTypeDistribution;
            this.arithmeticProgressions = arithmeticProgressions;
            this.averageGapSize = averageGapSize;
            this.gapVariance = gapVariance;
            this.patternCharacteristics = patternCharacteristics;
        }
        
        /**
         * Creates a simple pattern analysis for basic pattern information.
         * 
         * @param totalPatterns Total patterns
         * @param arithmeticProgressions Number of arithmetic progressions
         * @param averageGapSize Average gap size
         * @return Simple pattern analysis
         */
        public static DeltaPatternAnalysis simple(int totalPatterns, int arithmeticProgressions, double averageGapSize) {
            return new DeltaPatternAnalysis(
                totalPatterns,
                Map.of("ARITHMETIC", arithmeticProgressions, "OTHER", totalPatterns - arithmeticProgressions),
                arithmeticProgressions,
                averageGapSize,
                0.0,
                List.of("Standard delta patterns generated")
            );
        }
        
        public int getTotalPatterns() { return totalPatterns; }
        public Map<String, Integer> getPatternTypeDistribution() { return patternTypeDistribution; }
        public int getArithmeticProgressions() { return arithmeticProgressions; }
        public double getAverageGapSize() { return averageGapSize; }
        public double getGapVariance() { return gapVariance; }
        public List<String> getPatternCharacteristics() { return patternCharacteristics; }
        
        @Override
        public String toString() {
            return String.format("DeltaPatternAnalysis{total=%d, arithmetic=%d, avgGap=%.1f, variance=%.2f}",
                totalPatterns, arithmeticProgressions, averageGapSize, gapVariance);
        }
    }
    
    @Override
    public String toString() {
        return String.format("DeltaAnalysisResult{strategy=%s, efficiency=%.2f, strategic=%b, quality=%.1f}",
            deltaStrategy, deltaEfficiencyScore, strategicIntelligenceApplied,
            deltaValidation != null ? deltaValidation.getBatchStatistics().averageScore : 0.0);
    }
}