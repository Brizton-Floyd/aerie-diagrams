package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateGroup;
import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateMatrixTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Extended quality metrics that incorporate TemplateMatrix intelligence.
 * Provides additional scoring dimensions based on template probability distributions,
 * template group classifications, timing indicators, and mathematical quality assessments.
 * 
 * This class extends the traditional quality evaluation with TemplateMatrix-specific
 * insights to provide more sophisticated quality scoring for lottery ticket sets.
 */
public class TemplateMatrixQualityMetrics {
    
    // Core TemplateMatrix metrics
    private final double templateProbabilityScore;
    private final Map<TemplateGroup, Double> templateGroupDistribution;
    private final double templateCoveragePercentage;
    private final double averageTemplateProbability;
    
    // Template performance metrics
    private final int uniqueTemplatesUsed;
    private final double overdueTemplateUtilization;
    private final double templateBalanceScore;
    private final double templateDiversityScore;
    
    // Mathematical quality metrics
    private final double mathematicalAccuracyScore;
    private final double probabilityDistributionScore;
    private final double templateEfficiencyScore;
    
    // Template timing and strategy metrics
    private final Map<String, Integer> timingIndicatorDistribution;
    private final double strategicFitScore;
    private final List<TemplateQualityDetail> templateDetails;
    
    // Overall template-enhanced quality
    private final double enhancedQualityScore;
    private final String templateQualityGrade;
    
    public TemplateMatrixQualityMetrics(
            double templateProbabilityScore,
            Map<TemplateGroup, Double> templateGroupDistribution,
            double templateCoveragePercentage,
            double averageTemplateProbability,
            int uniqueTemplatesUsed,
            double overdueTemplateUtilization,
            double templateBalanceScore,
            double templateDiversityScore,
            double mathematicalAccuracyScore,
            double probabilityDistributionScore,
            double templateEfficiencyScore,
            Map<String, Integer> timingIndicatorDistribution,
            double strategicFitScore,
            List<TemplateQualityDetail> templateDetails,
            double enhancedQualityScore,
            String templateQualityGrade) {
        
        this.templateProbabilityScore = templateProbabilityScore;
        this.templateGroupDistribution = templateGroupDistribution;
        this.templateCoveragePercentage = templateCoveragePercentage;
        this.averageTemplateProbability = averageTemplateProbability;
        this.uniqueTemplatesUsed = uniqueTemplatesUsed;
        this.overdueTemplateUtilization = overdueTemplateUtilization;
        this.templateBalanceScore = templateBalanceScore;
        this.templateDiversityScore = templateDiversityScore;
        this.mathematicalAccuracyScore = mathematicalAccuracyScore;
        this.probabilityDistributionScore = probabilityDistributionScore;
        this.templateEfficiencyScore = templateEfficiencyScore;
        this.timingIndicatorDistribution = timingIndicatorDistribution;
        this.strategicFitScore = strategicFitScore;
        this.templateDetails = templateDetails;
        this.enhancedQualityScore = enhancedQualityScore;
        this.templateQualityGrade = templateQualityGrade;
    }
    
    // Core TemplateMatrix metrics getters
    
    /**
     * Gets the template probability score (0-100).
     * Higher scores indicate usage of templates with better mathematical probabilities.
     */
    public double getTemplateProbabilityScore() {
        return templateProbabilityScore;
    }
    
    /**
     * Gets the distribution of tickets across template groups.
     * Shows percentage of tickets using BEST, GOOD, FAIR, POOR templates.
     */
    public Map<TemplateGroup, Double> getTemplateGroupDistribution() {
        return templateGroupDistribution;
    }
    
    /**
     * Gets the percentage of available templates covered by generated tickets.
     * Higher coverage indicates better template diversity.
     */
    public double getTemplateCoveragePercentage() {
        return templateCoveragePercentage;
    }
    
    /**
     * Gets the average probability of all templates used in generation.
     */
    public double getAverageTemplateProbability() {
        return averageTemplateProbability;
    }
    
    // Template performance metrics getters
    
    /**
     * Gets the number of unique templates used in the ticket set.
     */
    public int getUniqueTemplatesUsed() {
        return uniqueTemplatesUsed;
    }
    
    /**
     * Gets the percentage of overdue templates utilized (0-100).
     * Higher scores indicate good timing-based selection.
     */
    public double getOverdueTemplateUtilization() {
        return overdueTemplateUtilization;
    }
    
    /**
     * Gets the template balance score measuring even distribution across groups.
     */
    public double getTemplateBalanceScore() {
        return templateBalanceScore;
    }
    
    /**
     * Gets the template diversity score measuring variety in template selection.
     */
    public double getTemplateDiversityScore() {
        return templateDiversityScore;
    }
    
    // Mathematical quality metrics getters
    
    /**
     * Gets the mathematical accuracy score based on probability calculations.
     */
    public double getMathematicalAccuracyScore() {
        return mathematicalAccuracyScore;
    }
    
    /**
     * Gets the probability distribution score measuring adherence to expected distributions.
     */
    public double getProbabilityDistributionScore() {
        return probabilityDistributionScore;
    }
    
    /**
     * Gets the template efficiency score measuring optimal template utilization.
     */
    public double getTemplateEfficiencyScore() {
        return templateEfficiencyScore;
    }
    
    // Template timing and strategy metrics getters
    
    /**
     * Gets the distribution of timing indicators across templates used.
     */
    public Map<String, Integer> getTimingIndicatorDistribution() {
        return timingIndicatorDistribution;
    }
    
    /**
     * Gets the strategic fit score measuring alignment with selection strategy.
     */
    public double getStrategicFitScore() {
        return strategicFitScore;
    }
    
    /**
     * Gets detailed quality information for each template used.
     */
    public List<TemplateQualityDetail> getTemplateDetails() {
        return templateDetails;
    }
    
    // Overall template-enhanced quality getters
    
    /**
     * Gets the enhanced quality score incorporating TemplateMatrix intelligence (0-100).
     */
    public double getEnhancedQualityScore() {
        return enhancedQualityScore;
    }
    
    /**
     * Gets the template-based quality grade (A+ to F).
     */
    public String getTemplateQualityGrade() {
        return templateQualityGrade;
    }
    
    // Convenience methods for specific template group percentages
    
    public double getBestTemplatePercentage() {
        return templateGroupDistribution.getOrDefault(TemplateGroup.BEST, 0.0);
    }
    
    public double getGoodTemplatePercentage() {
        return templateGroupDistribution.getOrDefault(TemplateGroup.GOOD, 0.0);
    }
    
    public double getFairTemplatePercentage() {
        return templateGroupDistribution.getOrDefault(TemplateGroup.FAIR, 0.0);
    }
    
    public double getPoorTemplatePercentage() {
        return templateGroupDistribution.getOrDefault(TemplateGroup.POOR, 0.0);
    }
    
    // Quality assessment methods
    
    /**
     * Checks if the template quality indicates premium-level generation.
     */
    public boolean isPremiumQuality() {
        return enhancedQualityScore >= 85.0 && getBestTemplatePercentage() >= 50.0;
    }
    
    /**
     * Checks if template utilization meets strategic objectives.
     */
    public boolean meetsStrategicObjectives() {
        return strategicFitScore >= 70.0 && templateCoveragePercentage >= 15.0;
    }
    
    /**
     * Checks if mathematical quality standards are met.
     */
    public boolean meetsMathematicalStandards() {
        return mathematicalAccuracyScore >= 80.0 && probabilityDistributionScore >= 75.0;
    }
    
    /**
     * Gets a comprehensive summary of template quality metrics.
     */
    public String getTemplateSummary() {
        return String.format(
                "Template Quality: %s (%.1f%%) - %d unique templates, %.1f%% BEST, %.1f%% coverage, %.4f avg probability",
                templateQualityGrade, enhancedQualityScore, uniqueTemplatesUsed, 
                getBestTemplatePercentage(), templateCoveragePercentage, averageTemplateProbability
        );
    }
    
    /**
     * Gets a detailed analysis report of all template metrics.
     */
    public String getDetailedAnalysis() {
        StringBuilder analysis = new StringBuilder();
        analysis.append(String.format("=== TemplateMatrix Quality Analysis ===\n"));
        analysis.append(String.format("Enhanced Quality Score: %.1f%% (%s)\n", enhancedQualityScore, templateQualityGrade));
        analysis.append(String.format("Template Probability Score: %.1f%%\n", templateProbabilityScore));
        analysis.append(String.format("Template Coverage: %.1f%% (%d unique templates)\n", templateCoveragePercentage, uniqueTemplatesUsed));
        analysis.append(String.format("Average Template Probability: %.4f\n", averageTemplateProbability));
        
        analysis.append(String.format("\nTemplate Group Distribution:\n"));
        analysis.append(String.format("  BEST: %.1f%%\n", getBestTemplatePercentage()));
        analysis.append(String.format("  GOOD: %.1f%%\n", getGoodTemplatePercentage()));
        analysis.append(String.format("  FAIR: %.1f%%\n", getFairTemplatePercentage()));
        analysis.append(String.format("  POOR: %.1f%%\n", getPoorTemplatePercentage()));
        
        analysis.append(String.format("\nQuality Scores:\n"));
        analysis.append(String.format("  Mathematical Accuracy: %.1f%%\n", mathematicalAccuracyScore));
        analysis.append(String.format("  Probability Distribution: %.1f%%\n", probabilityDistributionScore));
        analysis.append(String.format("  Template Efficiency: %.1f%%\n", templateEfficiencyScore));
        analysis.append(String.format("  Strategic Fit: %.1f%%\n", strategicFitScore));
        analysis.append(String.format("  Template Balance: %.1f%%\n", templateBalanceScore));
        analysis.append(String.format("  Template Diversity: %.1f%%\n", templateDiversityScore));
        
        if (overdueTemplateUtilization > 0) {
            analysis.append(String.format("  Overdue Template Utilization: %.1f%%\n", overdueTemplateUtilization));
        }
        
        return analysis.toString();
    }
    
    @Override
    public String toString() {
        return String.format("TemplateMatrixQualityMetrics{score=%.1f, grade=%s, templates=%d, best=%.1f%%, coverage=%.1f%%}",
                enhancedQualityScore, templateQualityGrade, uniqueTemplatesUsed, getBestTemplatePercentage(), templateCoveragePercentage);
    }
    
    /**
     * Detail information for individual template quality assessment.
     */
    public static class TemplateQualityDetail {
        private final String patternString;
        private final TemplateGroup templateGroup;
        private final double probability;
        private final int usageCount;
        private final double qualityContribution;
        private final String timingIndicator;
        private final boolean isOverdue;
        
        public TemplateQualityDetail(String patternString, TemplateGroup templateGroup, 
                                   double probability, int usageCount, double qualityContribution,
                                   String timingIndicator, boolean isOverdue) {
            this.patternString = patternString;
            this.templateGroup = templateGroup;
            this.probability = probability;
            this.usageCount = usageCount;
            this.qualityContribution = qualityContribution;
            this.timingIndicator = timingIndicator;
            this.isOverdue = isOverdue;
        }
        
        // Getters
        public String getPatternString() { return patternString; }
        public TemplateGroup getTemplateGroup() { return templateGroup; }
        public double getProbability() { return probability; }
        public int getUsageCount() { return usageCount; }
        public double getQualityContribution() { return qualityContribution; }
        public String getTimingIndicator() { return timingIndicator; }
        public boolean isOverdue() { return isOverdue; }
        
        @Override
        public String toString() {
            return String.format("%s (%s): %.4f prob, %d uses, %.1f%% contrib%s",
                    patternString, templateGroup, probability, usageCount, qualityContribution,
                    isOverdue ? " [OVERDUE]" : "");
        }
    }
}