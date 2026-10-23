package com.floyd.lottoptions.legacy.desktop.shared.template;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Container for the results of TemplateMatrix analysis operations.
 * Provides comprehensive insights into template performance, distribution, and recommendations.
 */
public class TemplateMatrixAnalysisResult {
    
    private final String lotteryConfigId;
    private final LocalDateTime analysisTimestamp;
    private final int totalTemplates;
    private final int totalDrawsAnalyzed;
    private final List<TemplateMatrixTemplate> allTemplates;
    private final Map<TemplateGroup, List<TemplateMatrixTemplate>> templatesByGroup;
    private final List<TemplateMatrixTemplate> recommendedTemplates;
    private final List<TemplateMatrixTemplate> overdueTemplates;
    private final TemplateDistributionMetrics distributionMetrics;
    
    public TemplateMatrixAnalysisResult(String lotteryConfigId, 
                                       List<TemplateMatrixTemplate> allTemplates,
                                       int totalDrawsAnalyzed) {
        this.lotteryConfigId = lotteryConfigId;
        this.analysisTimestamp = LocalDateTime.now();
        this.totalTemplates = allTemplates.size();
        this.totalDrawsAnalyzed = totalDrawsAnalyzed;
        this.allTemplates = allTemplates;
        
        // Group templates by classification
        this.templatesByGroup = allTemplates.stream()
                .collect(Collectors.groupingBy(TemplateMatrixTemplate::getTemplateGroup));
        
        // Filter recommended templates (BEST and GOOD groups, good timing)
        this.recommendedTemplates = allTemplates.stream()
                .filter(TemplateMatrixTemplate::isRecommendedForGeneration)
                .collect(Collectors.toList());
        
        // Filter overdue templates
        this.overdueTemplates = allTemplates.stream()
                .filter(TemplateMatrixTemplate::isOverdue)
                .collect(Collectors.toList());
        
        // Calculate distribution metrics
        this.distributionMetrics = calculateDistributionMetrics();
    }
    
    /**
     * Gets all templates analyzed.
     */
    public List<TemplateMatrixTemplate> getAllTemplates() {
        return allTemplates;
    }
    
    /**
     * Gets templates grouped by their classification.
     */
    public Map<TemplateGroup, List<TemplateMatrixTemplate>> getTemplatesByGroup() {
        return templatesByGroup;
    }
    
    /**
     * Gets templates recommended for generation.
     */
    public List<TemplateMatrixTemplate> getRecommendedTemplates() {
        return recommendedTemplates;
    }
    
    /**
     * Gets templates that are currently overdue.
     */
    public List<TemplateMatrixTemplate> getOverdueTemplates() {
        return overdueTemplates;
    }
    
    /**
     * Gets templates by specific group.
     */
    public List<TemplateMatrixTemplate> getTemplatesByGroup(TemplateGroup group) {
        return templatesByGroup.getOrDefault(group, List.of());
    }
    
    /**
     * Gets the top N templates by probability.
     */
    public List<TemplateMatrixTemplate> getTopTemplatesByProbability(int count) {
        return allTemplates.stream()
                .sorted((t1, t2) -> t2.getProbability().compareTo(t1.getProbability()))
                .limit(count)
                .collect(Collectors.toList());
    }
    
    /**
     * Gets templates that match a specific pattern string.
     */
    public TemplateMatrixTemplate getTemplateByPattern(String pattern) {
        return allTemplates.stream()
                .filter(t -> t.getPatternString().equals(pattern))
                .findFirst()
                .orElse(null);
    }
    
    /**
     * Gets distribution metrics for analysis overview.
     */
    public TemplateDistributionMetrics getDistributionMetrics() {
        return distributionMetrics;
    }
    
    /**
     * Basic getters for analysis metadata.
     */
    public String getLotteryConfigId() { return lotteryConfigId; }
    public LocalDateTime getAnalysisTimestamp() { return analysisTimestamp; }
    public int getTotalTemplates() { return totalTemplates; }
    public int getTotalDrawsAnalyzed() { return totalDrawsAnalyzed; }
    
    /**
     * Calculates comprehensive distribution metrics.
     */
    private TemplateDistributionMetrics calculateDistributionMetrics() {
        int bestCount = templatesByGroup.getOrDefault(TemplateGroup.BEST, List.of()).size();
        int goodCount = templatesByGroup.getOrDefault(TemplateGroup.GOOD, List.of()).size();
        int fairCount = templatesByGroup.getOrDefault(TemplateGroup.FAIR, List.of()).size();
        int poorCount = templatesByGroup.getOrDefault(TemplateGroup.POOR, List.of()).size();
        
        double avgHitCount = allTemplates.stream()
                .mapToInt(TemplateMatrixTemplate::getHitCount)
                .average()
                .orElse(0.0);
        
        double avgGamesOut = allTemplates.stream()
                .mapToInt(TemplateMatrixTemplate::getGamesOut)
                .average()
                .orElse(0.0);
        
        int templatesWithHits = (int) allTemplates.stream()
                .filter(t -> t.getHitCount() > 0)
                .count();
        
        double coveragePercentage = totalTemplates > 0 ? 
                (double) templatesWithHits / totalTemplates * 100 : 0.0;
        
        return new TemplateDistributionMetrics(
                bestCount, goodCount, fairCount, poorCount,
                recommendedTemplates.size(), overdueTemplates.size(),
                avgHitCount, avgGamesOut, coveragePercentage
        );
    }
    
    @Override
    public String toString() {
        return String.format(
                "TemplateMatrix Analysis [%s]: %d templates analyzed from %d draws\n" +
                "Distribution: BEST=%d, GOOD=%d, FAIR=%d, POOR=%d\n" +
                "Recommended: %d templates, Overdue: %d templates",
                lotteryConfigId, totalTemplates, totalDrawsAnalyzed,
                getTemplatesByGroup(TemplateGroup.BEST).size(),
                getTemplatesByGroup(TemplateGroup.GOOD).size(),
                getTemplatesByGroup(TemplateGroup.FAIR).size(),
                getTemplatesByGroup(TemplateGroup.POOR).size(),
                recommendedTemplates.size(), overdueTemplates.size()
        );
    }
    
    /**
     * Inner class containing distribution metrics for the analysis.
     */
    public static class TemplateDistributionMetrics {
        private final int bestGroupCount;
        private final int goodGroupCount;
        private final int fairGroupCount;
        private final int poorGroupCount;
        private final int recommendedCount;
        private final int overdueCount;
        private final double averageHitCount;
        private final double averageGamesOut;
        private final double coveragePercentage;
        
        public TemplateDistributionMetrics(int bestGroupCount, int goodGroupCount, 
                                         int fairGroupCount, int poorGroupCount,
                                         int recommendedCount, int overdueCount,
                                         double averageHitCount, double averageGamesOut,
                                         double coveragePercentage) {
            this.bestGroupCount = bestGroupCount;
            this.goodGroupCount = goodGroupCount;
            this.fairGroupCount = fairGroupCount;
            this.poorGroupCount = poorGroupCount;
            this.recommendedCount = recommendedCount;
            this.overdueCount = overdueCount;
            this.averageHitCount = averageHitCount;
            this.averageGamesOut = averageGamesOut;
            this.coveragePercentage = coveragePercentage;
        }
        
        // Getters
        public int getBestGroupCount() { return bestGroupCount; }
        public int getGoodGroupCount() { return goodGroupCount; }
        public int getFairGroupCount() { return fairGroupCount; }
        public int getPoorGroupCount() { return poorGroupCount; }
        public int getRecommendedCount() { return recommendedCount; }
        public int getOverdueCount() { return overdueCount; }
        public double getAverageHitCount() { return averageHitCount; }
        public double getAverageGamesOut() { return averageGamesOut; }
        public double getCoveragePercentage() { return coveragePercentage; }
        
        @Override
        public String toString() {
            return String.format(
                    "Metrics: BEST=%d, GOOD=%d, FAIR=%d, POOR=%d | " +
                    "Recommended=%d, Overdue=%d | " +
                    "Avg Hits=%.1f, Avg Out=%.1f, Coverage=%.1f%%",
                    bestGroupCount, goodGroupCount, fairGroupCount, poorGroupCount,
                    recommendedCount, overdueCount,
                    averageHitCount, averageGamesOut, coveragePercentage
            );
        }
    }
}