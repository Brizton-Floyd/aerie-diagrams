package com.floyd.lottoptions.legacy.desktop.generation.performance;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Phase 2: Contains comprehensive pattern performance analysis results.
 * This class provides pattern-to-prize-tier correlations and success probabilities
 * derived from historical lottery data analysis.
 */
public class PatternPerformanceAnalysis {
    
    private final Map<String, PrizeTierPatternStats> patternStats;
    private final Map<String, Double> patternSuccessRates;
    private final Map<String, List<String>> topPatternsPerTier;
    private final List<String> insights;
    private final String lotteryConfigId;
    private final LocalDate analysisDate;
    private final int historicalDrawsAnalyzed;
    
    public PatternPerformanceAnalysis(Map<String, PrizeTierPatternStats> patternStats,
                                    Map<String, Double> patternSuccessRates,
                                    Map<String, List<String>> topPatternsPerTier,
                                    List<String> insights,
                                    String lotteryConfigId,
                                    LocalDate analysisDate,
                                    int historicalDrawsAnalyzed) {
        this.patternStats = patternStats;
        this.patternSuccessRates = patternSuccessRates;
        this.topPatternsPerTier = topPatternsPerTier;
        this.insights = insights;
        this.lotteryConfigId = lotteryConfigId;
        this.analysisDate = analysisDate;
        this.historicalDrawsAnalyzed = historicalDrawsAnalyzed;
    }
    
    /**
     * Gets the complete pattern statistics for all analyzed patterns.
     */
    public Map<String, PrizeTierPatternStats> getPatternStats() {
        return patternStats;
    }
    
    /**
     * Gets success rates for all patterns (0.0 to 1.0).
     */
    public Map<String, Double> getPatternSuccessRates() {
        return patternSuccessRates;
    }
    
    /**
     * Gets the top-performing patterns for each prize tier.
     */
    public Map<String, List<String>> getTopPatternsPerTier() {
        return topPatternsPerTier;
    }
    
    /**
     * Gets patterns that historically produced the specified prize tier.
     */
    public List<String> getPatternsForPrizeTier(String prizeTier) {
        return topPatternsPerTier.getOrDefault(prizeTier, Collections.emptyList());
    }
    
    /**
     * Gets the best patterns for a specific prize tier, ranked by performance score.
     */
    public List<String> getBestPatternsForTier(String prizeTier, int limit) {
        return patternStats.entrySet().stream()
            .filter(e -> e.getValue().getPrizeTierScore(prizeTier) > 0)
            .sorted((e1, e2) -> Double.compare(
                e2.getValue().getPrizeTierScore(prizeTier), 
                e1.getValue().getPrizeTierScore(prizeTier)))
            .limit(limit)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }
    
    /**
     * Gets the success rate for a specific pattern.
     */
    public double getPatternSuccessRate(String pattern) {
        return patternSuccessRates.getOrDefault(pattern, 0.0);
    }
    
    /**
     * Gets patterns with high versatility (good across multiple prize tiers).
     */
    public List<String> getVersatilePatterns(int limit) {
        return patternStats.entrySet().stream()
            .filter(e -> e.getValue().getVersatilityScore() > 0.3)
            .sorted((e1, e2) -> Double.compare(
                e2.getValue().getVersatilityScore(), 
                e1.getValue().getVersatilityScore()))
            .limit(limit)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }
    
    /**
     * Gets patterns with the highest overall success rates.
     */
    public List<String> getHighestSuccessRatePatterns(int limit) {
        return patternSuccessRates.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .limit(limit)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }
    
    /**
     * Gets patterns that have occurred recently (within the last portion of historical data).
     */
    public List<String> getRecentlyActivePatterns(int limit) {
        LocalDate cutoffDate = analysisDate.minusMonths(6); // Last 6 months of data
        
        return patternStats.entrySet().stream()
            .filter(e -> e.getValue().getMostRecentOccurrence()
                .map(date -> date.isAfter(cutoffDate))
                .orElse(false))
            .sorted((e1, e2) -> {
                LocalDate date1 = e1.getValue().getMostRecentOccurrence().orElse(LocalDate.MIN);
                LocalDate date2 = e2.getValue().getMostRecentOccurrence().orElse(LocalDate.MIN);
                return date2.compareTo(date1);
            })
            .limit(limit)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }
    
    /**
     * Gets strategic pattern recommendations based on drought analysis integration.
     */
    public Map<String, Double> getStrategicPatternWeights(String targetPrizeTier, double droughtWeight) {
        Map<String, Double> weights = new HashMap<>();
        
        // Get top patterns for the target prize tier
        List<String> topPatterns = getBestPatternsForTier(targetPrizeTier, 10);
        
        for (String pattern : topPatterns) {
            PrizeTierPatternStats stats = patternStats.get(pattern);
            if (stats != null) {
                double baseWeight = stats.getPrizeTierScore(targetPrizeTier);
                double successRate = getPatternSuccessRate(pattern);
                double versatility = stats.getVersatilityScore();
                
                // Combine multiple factors for strategic weighting
                double strategicWeight = (baseWeight * 0.5) + (successRate * 0.3) + (versatility * 0.2);
                
                // Apply drought analysis multiplier
                strategicWeight *= droughtWeight;
                
                weights.put(pattern, strategicWeight);
            }
        }
        
        return weights;
    }
    
    /**
     * Gets performance insights generated from the analysis.
     */
    public List<String> getInsights() {
        return insights;
    }
    
    /**
     * Gets a summary of the analysis scope and key findings.
     */
    public String getAnalysisSummary() {
        int totalPatterns = patternStats.size();
        int patternsWithWins = (int) patternStats.values().stream()
            .mapToDouble(PrizeTierPatternStats::getTotalPrizeValue)
            .filter(value -> value > 0)
            .count();
        
        double avgSuccessRate = patternSuccessRates.values().stream()
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);
        
        return String.format("Analyzed %d patterns from %d historical draws. " +
                           "%d patterns showed winning potential with average success rate of %.1f%%", 
                           totalPatterns, historicalDrawsAnalyzed, patternsWithWins, avgSuccessRate * 100);
    }
    
    /**
     * Checks if the analysis contains significant data.
     */
    public boolean hasSignificantData() {
        return !patternStats.isEmpty() && historicalDrawsAnalyzed > 10;
    }
    
    /**
     * Gets the lottery configuration this analysis applies to.
     */
    public String getLotteryConfigId() {
        return lotteryConfigId;
    }
    
    /**
     * Gets the date when this analysis was performed.
     */
    public LocalDate getAnalysisDate() {
        return analysisDate;
    }
    
    /**
     * Gets the number of historical draws analyzed.
     */
    public int getHistoricalDrawsAnalyzed() {
        return historicalDrawsAnalyzed;
    }
    
    /**
     * Gets performance comparison between patterns.
     */
    public PatternComparison comparePatterns(String pattern1, String pattern2) {
        PrizeTierPatternStats stats1 = patternStats.get(pattern1);
        PrizeTierPatternStats stats2 = patternStats.get(pattern2);
        
        if (stats1 == null || stats2 == null) {
            return null;
        }
        
        return new PatternComparison(
            pattern1, pattern2,
            stats1.getSummary(), stats2.getSummary(),
            getPatternSuccessRate(pattern1), getPatternSuccessRate(pattern2)
        );
    }
    
    @Override
    public String toString() {
        return String.format("PatternPerformanceAnalysis{config='%s', patterns=%d, draws=%d, date=%s}", 
                           lotteryConfigId, patternStats.size(), historicalDrawsAnalyzed, analysisDate);
    }
    
    /**
     * Comparison class for pattern performance.
     */
    public static class PatternComparison {
        private final String pattern1;
        private final String pattern2;
        private final PrizeTierPatternStats.PatternSummary summary1;
        private final PrizeTierPatternStats.PatternSummary summary2;
        private final double successRate1;
        private final double successRate2;
        
        public PatternComparison(String pattern1, String pattern2,
                               PrizeTierPatternStats.PatternSummary summary1,
                               PrizeTierPatternStats.PatternSummary summary2,
                               double successRate1, double successRate2) {
            this.pattern1 = pattern1;
            this.pattern2 = pattern2;
            this.summary1 = summary1;
            this.summary2 = summary2;
            this.successRate1 = successRate1;
            this.successRate2 = successRate2;
        }
        
        public String getBetterPattern() {
            return successRate1 > successRate2 ? pattern1 : pattern2;
        }
        
        public String getComparisonSummary() {
            double difference = Math.abs(successRate1 - successRate2) * 100;
            return String.format("%s outperforms %s by %.1f%% success rate", 
                               getBetterPattern(), 
                               successRate1 > successRate2 ? pattern2 : pattern1, 
                               difference);
        }
        
        // Getters
        public String getPattern1() { return pattern1; }
        public String getPattern2() { return pattern2; }
        public PrizeTierPatternStats.PatternSummary getSummary1() { return summary1; }
        public PrizeTierPatternStats.PatternSummary getSummary2() { return summary2; }
        public double getSuccessRate1() { return successRate1; }
        public double getSuccessRate2() { return successRate2; }
    }
}