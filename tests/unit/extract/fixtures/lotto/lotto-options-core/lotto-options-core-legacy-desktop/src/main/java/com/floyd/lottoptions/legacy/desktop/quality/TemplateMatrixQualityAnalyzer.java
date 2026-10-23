package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.shared.template.*;
import com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical.TemplateMatrixLotteryNumberGenerator;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Advanced quality analyzer that evaluates lottery ticket sets using TemplateMatrix intelligence.
 * This analyzer provides sophisticated quality scoring by incorporating template probability
 * distributions, group classifications, timing indicators, and mathematical accuracy metrics.
 * 
 * Key Features:
 * - Template-based quality scoring beyond traditional pattern analysis
 * - Mathematical accuracy assessment using combinatorial probabilities
 * - Template group distribution analysis (BEST/GOOD/FAIR/POOR)
 * - Timing-aware quality metrics (overdue pattern utilization)
 * - Strategic fit assessment based on template selection strategy
 */
public class TemplateMatrixQualityAnalyzer {
    
    private final TemplateMatrixGenerator templateGenerator;
    
    public TemplateMatrixQualityAnalyzer() {
        this.templateGenerator = new TemplateMatrixGenerator();
    }
    
    /**
     * Performs comprehensive TemplateMatrix quality analysis on a ticket set.
     * 
     * @param tickets List of generated lottery tickets
     * @param lotteryConfig Lottery configuration (min/max numbers, pick size)
     * @param selectionStrategy The strategy used for template selection
     * @param allowedGroups The template groups that were allowed during generation
     * @return TemplateMatrixQualityMetrics with comprehensive analysis
     */
    public TemplateMatrixQualityMetrics analyzeTemplateQuality(
            List<int[]> tickets,
            LotteryConfiguration lotteryConfig,
            TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy selectionStrategy,
            Set<TemplateGroup> allowedGroups) {
        
        if (tickets == null || tickets.isEmpty()) {
            return createEmptyTemplateQualityMetrics();
        }
        
        // Generate all possible templates for this lottery configuration
        List<TemplateMatrixTemplate> allTemplates = templateGenerator.generateAllTemplates(
                lotteryConfig.minNumber, lotteryConfig.maxNumber, lotteryConfig.pickSize);
        
        // Analyze which templates were used
        TemplateUsageAnalysis usageAnalysis = analyzeTemplateUsage(tickets, allTemplates);
        
        // Calculate core TemplateMatrix metrics
        double templateProbabilityScore = calculateTemplateProbabilityScore(usageAnalysis);
        Map<TemplateGroup, Double> groupDistribution = calculateTemplateGroupDistribution(usageAnalysis);
        double templateCoverage = calculateTemplateCoverage(usageAnalysis, allTemplates);
        double avgProbability = calculateAverageTemplateProbability(usageAnalysis);
        
        // Calculate performance metrics
        int uniqueTemplates = usageAnalysis.getUniqueTemplateCount();
        double overdueUtilization = calculateOverdueTemplateUtilization(usageAnalysis);
        double balanceScore = calculateTemplateBalanceScore(groupDistribution);
        double diversityScore = calculateTemplateDiversityScore(usageAnalysis, allTemplates);
        
        // Calculate mathematical quality metrics
        double mathematicalAccuracy = calculateMathematicalAccuracyScore(usageAnalysis);
        double probabilityDistribution = calculateProbabilityDistributionScore(usageAnalysis, allTemplates);
        double templateEfficiency = calculateTemplateEfficiencyScore(usageAnalysis, allowedGroups);
        
        // Calculate timing and strategy metrics
        Map<String, Integer> timingDistribution = calculateTimingIndicatorDistribution(usageAnalysis);
        double strategicFit = calculateStrategicFitScore(usageAnalysis, selectionStrategy, allowedGroups);
        List<TemplateMatrixQualityMetrics.TemplateQualityDetail> templateDetails = createTemplateDetails(usageAnalysis);
        
        // Calculate overall enhanced quality score
        double enhancedScore = calculateEnhancedQualityScore(
                templateProbabilityScore, balanceScore, diversityScore, mathematicalAccuracy,
                probabilityDistribution, templateEfficiency, strategicFit);
        
        String qualityGrade = calculateTemplateQualityGrade(enhancedScore, groupDistribution);
        
        return new TemplateMatrixQualityMetrics(
                templateProbabilityScore, groupDistribution, templateCoverage, avgProbability,
                uniqueTemplates, overdueUtilization, balanceScore, diversityScore,
                mathematicalAccuracy, probabilityDistribution, templateEfficiency,
                timingDistribution, strategicFit, templateDetails, enhancedScore, qualityGrade
        );
    }
    
    /**
     * Analyzes which templates were used in the ticket generation.
     */
    private TemplateUsageAnalysis analyzeTemplateUsage(List<int[]> tickets, List<TemplateMatrixTemplate> allTemplates) {
        Map<String, TemplateUsageInfo> templateUsage = new HashMap<>();
        
        for (int[] ticket : tickets) {
            TemplateMatrixTemplate matchingTemplate = findMatchingTemplate(ticket, allTemplates);
            if (matchingTemplate != null) {
                String patternKey = matchingTemplate.getPatternString();
                TemplateUsageInfo usage = templateUsage.computeIfAbsent(patternKey, 
                        k -> new TemplateUsageInfo(matchingTemplate));
                usage.incrementUsage();
            }
        }
        
        return new TemplateUsageAnalysis(templateUsage, tickets.size());
    }
    
    /**
     * Finds the template that matches a given ticket.
     */
    private TemplateMatrixTemplate findMatchingTemplate(int[] ticket, List<TemplateMatrixTemplate> templates) {
        for (TemplateMatrixTemplate template : templates) {
            if (template.matches(ticket)) {
                return template;
            }
        }
        return null;
    }
    
    /**
     * Calculates template probability score based on the mathematical probabilities of used templates.
     */
    private double calculateTemplateProbabilityScore(TemplateUsageAnalysis analysis) {
        if (analysis.getTotalTickets() == 0) return 0.0;
        
        double weightedProbabilitySum = 0.0;
        for (TemplateUsageInfo usage : analysis.getTemplateUsages()) {
            double templateProbability = usage.getTemplate().getProbability().doubleValue();
            double weight = (double) usage.getUsageCount() / analysis.getTotalTickets();
            weightedProbabilitySum += templateProbability * weight;
        }
        
        // Scale to 0-100 range (multiply by large factor since probabilities are small)
        return Math.min(100.0, weightedProbabilitySum * 10000);
    }
    
    /**
     * Calculates distribution of tickets across template groups.
     */
    private Map<TemplateGroup, Double> calculateTemplateGroupDistribution(TemplateUsageAnalysis analysis) {
        Map<TemplateGroup, Integer> groupCounts = new HashMap<>();
        
        for (TemplateUsageInfo usage : analysis.getTemplateUsages()) {
            TemplateGroup group = usage.getTemplate().getTemplateGroup();
            groupCounts.merge(group, usage.getUsageCount(), Integer::sum);
        }
        
        Map<TemplateGroup, Double> distribution = new HashMap<>();
        int totalTickets = analysis.getTotalTickets();
        
        for (TemplateGroup group : TemplateGroup.values()) {
            double percentage = totalTickets > 0 ? 
                    (groupCounts.getOrDefault(group, 0) * 100.0 / totalTickets) : 0.0;
            distribution.put(group, percentage);
        }
        
        return distribution;
    }
    
    /**
     * Calculates what percentage of available templates were used.
     */
    private double calculateTemplateCoverage(TemplateUsageAnalysis analysis, List<TemplateMatrixTemplate> allTemplates) {
        int usedTemplates = analysis.getUniqueTemplateCount();
        return allTemplates.isEmpty() ? 0.0 : (usedTemplates * 100.0 / allTemplates.size());
    }
    
    /**
     * Calculates average probability of all templates used.
     */
    private double calculateAverageTemplateProbability(TemplateUsageAnalysis analysis) {
        if (analysis.getTemplateUsages().isEmpty()) return 0.0;
        
        return analysis.getTemplateUsages().stream()
                .mapToDouble(usage -> usage.getTemplate().getProbability().doubleValue())
                .average()
                .orElse(0.0);
    }
    
    /**
     * Calculates utilization of overdue templates.
     */
    private double calculateOverdueTemplateUtilization(TemplateUsageAnalysis analysis) {
        int overdueUsage = 0;
        for (TemplateUsageInfo usage : analysis.getTemplateUsages()) {
            if (usage.getTemplate().isOverdue()) {
                overdueUsage += usage.getUsageCount();
            }
        }
        return analysis.getTotalTickets() > 0 ? (overdueUsage * 100.0 / analysis.getTotalTickets()) : 0.0;
    }
    
    /**
     * Calculates how balanced the template group distribution is.
     */
    private double calculateTemplateBalanceScore(Map<TemplateGroup, Double> distribution) {
        // Ideal distribution would have some representation from BEST and GOOD groups
        double bestPercentage = distribution.getOrDefault(TemplateGroup.BEST, 0.0);
        double goodPercentage = distribution.getOrDefault(TemplateGroup.GOOD, 0.0);
        double fairPercentage = distribution.getOrDefault(TemplateGroup.FAIR, 0.0);
        double poorPercentage = distribution.getOrDefault(TemplateGroup.POOR, 0.0);
        
        // Score based on having good representation in top groups
        double topGroupsPercentage = bestPercentage + goodPercentage;
        double balancePenalty = Math.max(0, poorPercentage - 30); // Penalize too much POOR usage
        
        return Math.max(0, Math.min(100, topGroupsPercentage - balancePenalty));
    }
    
    /**
     * Calculates template diversity score.
     */
    private double calculateTemplateDiversityScore(TemplateUsageAnalysis analysis, List<TemplateMatrixTemplate> allTemplates) {
        int uniqueUsed = analysis.getUniqueTemplateCount();
        int totalAvailable = allTemplates.size();
        
        // Base score from coverage
        double coverageScore = totalAvailable > 0 ? (uniqueUsed * 100.0 / totalAvailable) : 0.0;
        
        // Bonus for even distribution of usage
        double usageVariance = calculateUsageVariance(analysis);
        double evenDistributionBonus = Math.max(0, 20 - usageVariance); // Lower variance = higher bonus
        
        return Math.min(100, coverageScore + evenDistributionBonus);
    }
    
    /**
     * Calculates variance in template usage counts.
     */
    private double calculateUsageVariance(TemplateUsageAnalysis analysis) {
        List<TemplateUsageInfo> usages = new ArrayList<>(analysis.getTemplateUsages());
        if (usages.size() <= 1) return 0.0;
        
        double mean = usages.stream().mapToInt(TemplateUsageInfo::getUsageCount).average().orElse(0.0);
        double variance = usages.stream()
                .mapToDouble(usage -> Math.pow(usage.getUsageCount() - mean, 2))
                .average()
                .orElse(0.0);
        
        return Math.sqrt(variance);
    }
    
    /**
     * Calculates mathematical accuracy based on probability calculations.
     */
    private double calculateMathematicalAccuracyScore(TemplateUsageAnalysis analysis) {
        // This checks how well the usage aligns with expected mathematical probabilities
        double totalProbability = analysis.getTemplateUsages().stream()
                .mapToDouble(usage -> usage.getTemplate().getProbability().doubleValue())
                .sum();
        
        // Higher total probability indicates better mathematical selection
        return Math.min(100.0, totalProbability * 20000); // Scale appropriately
    }
    
    /**
     * Calculates how well the probability distribution follows expected patterns.
     */
    private double calculateProbabilityDistributionScore(TemplateUsageAnalysis analysis, List<TemplateMatrixTemplate> allTemplates) {
        // Check if usage pattern follows the probability hierarchy
        List<TemplateUsageInfo> usages = new ArrayList<>(analysis.getTemplateUsages());
        usages.sort((u1, u2) -> u2.getUsageCount() - u1.getUsageCount()); // Sort by usage count descending
        
        double score = 100.0;
        
        // Check if most-used templates have higher probabilities
        for (int i = 0; i < Math.min(3, usages.size() - 1); i++) {
            TemplateUsageInfo current = usages.get(i);
            TemplateUsageInfo next = usages.get(i + 1);
            
            if (current.getUsageCount() > next.getUsageCount() && 
                current.getTemplate().getProbability().compareTo(next.getTemplate().getProbability()) < 0) {
                score -= 15; // Penalty for inverse probability-usage relationship
            }
        }
        
        return Math.max(0, score);
    }
    
    /**
     * Calculates template efficiency based on optimal utilization of allowed groups.
     */
    private double calculateTemplateEfficiencyScore(TemplateUsageAnalysis analysis, Set<TemplateGroup> allowedGroups) {
        if (allowedGroups == null || allowedGroups.isEmpty()) return 100.0;
        
        int usageInAllowedGroups = 0;
        for (TemplateUsageInfo usage : analysis.getTemplateUsages()) {
            if (allowedGroups.contains(usage.getTemplate().getTemplateGroup())) {
                usageInAllowedGroups += usage.getUsageCount();
            }
        }
        
        return analysis.getTotalTickets() > 0 ? 
                (usageInAllowedGroups * 100.0 / analysis.getTotalTickets()) : 100.0;
    }
    
    /**
     * Calculates distribution of timing indicators.
     */
    private Map<String, Integer> calculateTimingIndicatorDistribution(TemplateUsageAnalysis analysis) {
        Map<String, Integer> distribution = new HashMap<>();
        
        for (TemplateUsageInfo usage : analysis.getTemplateUsages()) {
            TemplateMatrixTemplate.TimingIndicator timing = usage.getTemplate().getTimingIndicator();
            String indicator = timing != null ? timing.name() : "UNKNOWN";
            distribution.merge(indicator, usage.getUsageCount(), Integer::sum);
        }
        
        return distribution;
    }
    
    /**
     * Calculates strategic fit based on how well the results align with the selection strategy.
     */
    private double calculateStrategicFitScore(TemplateUsageAnalysis analysis, 
            TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy strategy, Set<TemplateGroup> allowedGroups) {
        
        Map<TemplateGroup, Double> groupDist = calculateTemplateGroupDistribution(analysis);
        
        switch (strategy) {
            case BEST_ONLY:
                return groupDist.getOrDefault(TemplateGroup.BEST, 0.0);
                
            case BEST_AND_GOOD:
                return groupDist.getOrDefault(TemplateGroup.BEST, 0.0) + 
                       groupDist.getOrDefault(TemplateGroup.GOOD, 0.0);
                
            case HIGH_PROBABILITY:
                // Check if high-probability templates were prioritized
                return calculateMathematicalAccuracyScore(analysis);
                
            case TIMING_AWARE:
                // Check if overdue templates were utilized
                return Math.min(100.0, calculateOverdueTemplateUtilization(analysis) * 2);
                
            case BALANCED:
                // Check for balanced distribution
                return calculateTemplateBalanceScore(groupDist);
                
            default:
                return 75.0; // Default decent score
        }
    }
    
    /**
     * Creates detailed information for each template used.
     */
    private List<TemplateMatrixQualityMetrics.TemplateQualityDetail> createTemplateDetails(TemplateUsageAnalysis analysis) {
        return analysis.getTemplateUsages().stream()
                .map(usage -> {
                    TemplateMatrixTemplate template = usage.getTemplate();
                    double contribution = (usage.getUsageCount() * 100.0) / analysis.getTotalTickets();
                    String timing = template.getTimingIndicator() != null ? 
                            template.getTimingIndicator().name() : "UNKNOWN";
                    
                    return new TemplateMatrixQualityMetrics.TemplateQualityDetail(
                            template.getPatternString(),
                            template.getTemplateGroup(),
                            template.getProbability().doubleValue(),
                            usage.getUsageCount(),
                            contribution,
                            timing,
                            template.isOverdue()
                    );
                })
                .sorted((d1, d2) -> Integer.compare(d2.getUsageCount(), d1.getUsageCount())) // Sort by usage count
                .collect(Collectors.toList());
    }
    
    /**
     * Calculates the overall enhanced quality score.
     */
    private double calculateEnhancedQualityScore(double templateProbability, double balance, double diversity,
                                               double mathematical, double probabilityDist, double efficiency, double strategicFit) {
        // Weighted combination of all factors
        return (templateProbability * 0.25) + (balance * 0.15) + (diversity * 0.15) + 
               (mathematical * 0.20) + (probabilityDist * 0.10) + (efficiency * 0.10) + (strategicFit * 0.05);
    }
    
    /**
     * Calculates template-based quality grade.
     */
    private String calculateTemplateQualityGrade(double enhancedScore, Map<TemplateGroup, Double> groupDistribution) {
        double bestPercentage = groupDistribution.getOrDefault(TemplateGroup.BEST, 0.0);
        
        if (enhancedScore >= 95 && bestPercentage >= 80) return "A+";
        if (enhancedScore >= 90 && bestPercentage >= 60) return "A";
        if (enhancedScore >= 80 && bestPercentage >= 40) return "A-";
        if (enhancedScore >= 75) return "B+";
        if (enhancedScore >= 65) return "B";
        if (enhancedScore >= 55) return "B-";
        if (enhancedScore >= 45) return "C";
        if (enhancedScore >= 35) return "D";
        return "F";
    }
    
    private TemplateMatrixQualityMetrics createEmptyTemplateQualityMetrics() {
        Map<TemplateGroup, Double> emptyDistribution = new HashMap<>();
        for (TemplateGroup group : TemplateGroup.values()) {
            emptyDistribution.put(group, 0.0);
        }
        
        return new TemplateMatrixQualityMetrics(
                0.0, emptyDistribution, 0.0, 0.0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                new HashMap<>(), 0.0, new ArrayList<>(), 0.0, "F"
        );
    }
    
    // Helper classes for analysis
    
    /**
     * Configuration for lottery games.
     */
    public static class LotteryConfiguration {
        public final int minNumber;
        public final int maxNumber;
        public final int pickSize;
        
        public LotteryConfiguration(int minNumber, int maxNumber, int pickSize) {
            this.minNumber = minNumber;
            this.maxNumber = maxNumber;
            this.pickSize = pickSize;
        }
    }
    
    /**
     * Analysis results for template usage.
     */
    private static class TemplateUsageAnalysis {
        private final Map<String, TemplateUsageInfo> templateUsage;
        private final int totalTickets;
        
        public TemplateUsageAnalysis(Map<String, TemplateUsageInfo> templateUsage, int totalTickets) {
            this.templateUsage = templateUsage;
            this.totalTickets = totalTickets;
        }
        
        public Collection<TemplateUsageInfo> getTemplateUsages() {
            return templateUsage.values();
        }
        
        public int getUniqueTemplateCount() {
            return templateUsage.size();
        }
        
        public int getTotalTickets() {
            return totalTickets;
        }
    }
    
    /**
     * Information about how a template was used.
     */
    private static class TemplateUsageInfo {
        private final TemplateMatrixTemplate template;
        private int usageCount;
        
        public TemplateUsageInfo(TemplateMatrixTemplate template) {
            this.template = template;
            this.usageCount = 0;
        }
        
        public void incrementUsage() {
            usageCount++;
        }
        
        public TemplateMatrixTemplate getTemplate() {
            return template;
        }
        
        public int getUsageCount() {
            return usageCount;
        }
    }
}