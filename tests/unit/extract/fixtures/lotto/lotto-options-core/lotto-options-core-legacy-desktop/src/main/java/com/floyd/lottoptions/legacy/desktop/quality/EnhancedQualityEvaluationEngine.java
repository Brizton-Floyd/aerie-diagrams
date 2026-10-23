package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.generation.criteria.StoppingCriteria;
import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;
import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateGroup;
import com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical.TemplateMatrixLotteryNumberGenerator;
import com.floyd.persistence.model.LotteryGame;

import java.util.*;

/**
 * Enhanced quality evaluation engine that combines traditional quality metrics
 * with TemplateMatrix intelligence for superior lottery ticket quality assessment.
 * 
 * This engine extends the original QualityEvaluationEngine by incorporating:
 * - TemplateMatrix-based quality scoring
 * - Template probability and group distribution analysis  
 * - Mathematical accuracy assessment using combinatorial probabilities
 * - Template timing and strategic fit evaluation
 * - Integrated quality metrics combining both traditional and template-based insights
 */
public class EnhancedQualityEvaluationEngine extends QualityEvaluationEngine {
    
    private final TemplateMatrixQualityAnalyzer templateAnalyzer;
    
    public EnhancedQualityEvaluationEngine(LotteryPersistenceClient persistenceClient) {
        super(persistenceClient);
        this.templateAnalyzer = new TemplateMatrixQualityAnalyzer();
    }
    
    /**
     * Performs comprehensive quality evaluation using both traditional and TemplateMatrix metrics.
     * 
     * @param tickets List of generated lottery tickets
     * @param stoppingCriteria The criteria used for generation
     * @param userRequest The original user request with preferences
     * @param lotteryGame The lottery game configuration (needed for TemplateMatrix analysis)
     * @return EnhancedQualityMetrics with both traditional and template-based analysis
     */
    public EnhancedQualityMetrics evaluateEnhancedQuality(
            List<int[]> tickets, 
            StoppingCriteria stoppingCriteria, 
            UserTargetingRequest userRequest,
            LotteryGame lotteryGame) {
        
        if (tickets == null || tickets.isEmpty()) {
            return createEmptyEnhancedQualityMetrics(userRequest.getLotteryConfigId());
        }
        
        // Perform traditional quality evaluation
        QualityMetrics traditionalMetrics = super.evaluateQuality(tickets, stoppingCriteria, userRequest);
        
        // Perform TemplateMatrix quality evaluation if enabled
        TemplateMatrixQualityMetrics templateMetrics = null;
        if (isTemplateMatrixEnabled(userRequest)) {
            templateMetrics = evaluateTemplateMatrixQuality(tickets, userRequest, lotteryGame);
        }
        
        // Combine metrics for enhanced scoring
        double enhancedScore = calculateCombinedQualityScore(traditionalMetrics, templateMetrics);
        String enhancedGrade = calculateEnhancedQualityGrade(enhancedScore, templateMetrics);
        
        // Create performance comparison metrics
        QualityImprovementAnalysis improvementAnalysis = analyzeQualityImprovement(
                traditionalMetrics, templateMetrics);
        
        return new EnhancedQualityMetrics(
                traditionalMetrics,
                templateMetrics,
                enhancedScore,
                enhancedGrade,
                improvementAnalysis
        );
    }
    
    /**
     * Evaluates TemplateMatrix quality for the ticket set.
     */
    private TemplateMatrixQualityMetrics evaluateTemplateMatrixQuality(
            List<int[]> tickets, UserTargetingRequest userRequest, LotteryGame lotteryGame) {
        
        try {
            // Extract lottery configuration
            TemplateMatrixQualityAnalyzer.LotteryConfiguration config = 
                    new TemplateMatrixQualityAnalyzer.LotteryConfiguration(
                            1, // Assume numbers start at 1
                            getLotteryMaxNumber(lotteryGame),
                            getLotteryPickSize(lotteryGame)
                    );
            
            // Get TemplateMatrix preferences from user request
            TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy strategy = 
                    getSelectionStrategy(userRequest);
            Set<TemplateGroup> allowedGroups = getAllowedGroups(userRequest);
            
            return templateAnalyzer.analyzeTemplateQuality(tickets, config, strategy, allowedGroups);
            
        } catch (Exception e) {
            System.err.println("Error evaluating TemplateMatrix quality: " + e.getMessage());
            return templateAnalyzer.analyzeTemplateQuality(tickets, 
                    new TemplateMatrixQualityAnalyzer.LotteryConfiguration(1, 35, 5),
                    TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy.BALANCED,
                    EnumSet.allOf(TemplateGroup.class));
        }
    }
    
    /**
     * Checks if TemplateMatrix evaluation is enabled for this request.
     */
    private boolean isTemplateMatrixEnabled(UserTargetingRequest userRequest) {
        return userRequest.getPreferences() != null && 
               userRequest.getPreferences().isEnableTemplateMatrix();
    }
    
    /**
     * Gets the template selection strategy from user preferences.
     */
    private TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy getSelectionStrategy(UserTargetingRequest userRequest) {
        if (userRequest.getPreferences() != null && userRequest.getPreferences().getTemplateSelectionStrategy() != null) {
            return userRequest.getPreferences().getTemplateSelectionStrategy();
        }
        return TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy.BALANCED;
    }
    
    /**
     * Gets the allowed template groups from user preferences.
     */
    private Set<TemplateGroup> getAllowedGroups(UserTargetingRequest userRequest) {
        System.out.println("DEBUG EnhancedQualityEvaluationEngine: Checking allowed groups...");
        
        if (userRequest.getPreferences() != null) {
            System.out.println("DEBUG EnhancedQualityEvaluationEngine: User preferences found");
            Set<TemplateGroup> userGroups = userRequest.getPreferences().getAllowedTemplateGroups();
            System.out.println("DEBUG EnhancedQualityEvaluationEngine: User allowedTemplateGroups = " + userGroups);
            
            if (userGroups != null && !userGroups.isEmpty()) {
                System.out.println("DEBUG EnhancedQualityEvaluationEngine: Using user-specified groups: " + userGroups);
                return userGroups;
            }
        } else {
            System.out.println("DEBUG EnhancedQualityEvaluationEngine: No user preferences found");
        }
        
        System.out.println("DEBUG EnhancedQualityEvaluationEngine: Falling back to default BEST+GOOD");
        return EnumSet.of(TemplateGroup.BEST, TemplateGroup.GOOD);
    }
    
    /**
     * Extracts lottery configuration from LotteryGame object.
     */
    private int getLotteryMaxNumber(LotteryGame lotteryGame) {
        if (lotteryGame != null && lotteryGame.getMaxNumber() != null) {
            return lotteryGame.getMaxNumber();
        }
        return 35; // Default fallback
    }
    
    private int getLotteryPickSize(LotteryGame lotteryGame) {
        if (lotteryGame != null && lotteryGame.getDrawPositionCount() != null) {
            return lotteryGame.getDrawPositionCount();
        }
        return 5; // Default fallback
    }
    
    /**
     * Calculates combined quality score from traditional and TemplateMatrix metrics.
     */
    private double calculateCombinedQualityScore(QualityMetrics traditional, TemplateMatrixQualityMetrics template) {
        double traditionalScore = traditional.getOptimizationScore();
        
        if (template == null) {
            return traditionalScore; // No template enhancement
        }
        
        double templateScore = template.getEnhancedQualityScore();
        
        // Weighted combination: 60% traditional, 40% template-based
        double combinedScore = (traditionalScore * 0.6) + (templateScore * 0.4);
        
        // Bonus for high template quality
        if (template.isPremiumQuality()) {
            combinedScore += 5.0; // Premium quality bonus
        }
        
        if (template.meetsMathematicalStandards()) {
            combinedScore += 3.0; // Mathematical standards bonus
        }
        
        return Math.min(100.0, combinedScore);
    }
    
    /**
     * Calculates enhanced quality grade considering both traditional and template metrics.
     */
    private String calculateEnhancedQualityGrade(double enhancedScore, TemplateMatrixQualityMetrics template) {
        String baseGrade = calculateQualityGradeFromScore(enhancedScore);
        
        if (template == null) {
            return baseGrade;
        }
        
        // Upgrade grade based on template quality
        if (template.isPremiumQuality() && enhancedScore >= 85) {
            if ("A".equals(baseGrade)) return "A+";
            if ("B".equals(baseGrade)) return "A-";
        }
        
        if (template.meetsMathematicalStandards() && enhancedScore >= 75) {
            if ("B".equals(baseGrade)) return "B+";
            if ("C".equals(baseGrade)) return "B-";
        }
        
        return baseGrade;
    }
    
    private String calculateQualityGradeFromScore(double score) {
        if (score >= 90) return "A";
        if (score >= 80) return "B";
        if (score >= 70) return "C";
        if (score >= 60) return "D";
        return "F";
    }
    
    /**
     * Analyzes quality improvement provided by TemplateMatrix integration.
     */
    private QualityImprovementAnalysis analyzeQualityImprovement(
            QualityMetrics traditional, TemplateMatrixQualityMetrics template) {
        
        if (template == null) {
            return new QualityImprovementAnalysis(0.0, "No TemplateMatrix analysis available", false);
        }
        
        double traditionalScore = traditional.getOptimizationScore();
        double templateScore = template.getEnhancedQualityScore();
        double improvement = templateScore - traditionalScore;
        double improvementPercentage = traditionalScore > 0 ? (improvement / traditionalScore) * 100 : 0;
        
        String improvementDescription = generateImprovementDescription(improvement, template);
        boolean significantImprovement = Math.abs(improvementPercentage) >= 10; // 10% threshold
        
        return new QualityImprovementAnalysis(improvementPercentage, improvementDescription, significantImprovement);
    }
    
    private String generateImprovementDescription(double improvement, TemplateMatrixQualityMetrics template) {
        if (improvement >= 15) {
            return String.format("Significant improvement through TemplateMatrix: %.1f%% BEST templates, excellent mathematical accuracy", 
                    template.getBestTemplatePercentage());
        } else if (improvement >= 5) {
            return String.format("Moderate improvement with TemplateMatrix: good template distribution and %.1f%% coverage",
                    template.getTemplateCoveragePercentage());
        } else if (improvement >= -5) {
            return "TemplateMatrix provides additional insights without major score impact";
        } else {
            return "Traditional methods currently outperforming TemplateMatrix for this configuration";
        }
    }
    
    private EnhancedQualityMetrics createEmptyEnhancedQualityMetrics(String lotteryConfigId) {
        QualityMetrics emptyTraditional = createEmptyQualityMetrics(lotteryConfigId);
        return new EnhancedQualityMetrics(
                emptyTraditional,
                null,
                0.0,
                "F",
                new QualityImprovementAnalysis(0.0, "No tickets to analyze", false)
        );
    }
    
    // For backward compatibility, this method needs access to the parent's private method
    // We'll duplicate the logic here
    private QualityMetrics createEmptyQualityMetrics(String lotteryConfigId) {
        ImprovementMetrics emptyImprovement = new ImprovementMetrics(0.0, 0.0, 0.0, false, "unknown");
        return new QualityMetrics(0.0, "F", 
                Map.of("HOT", 0.0, "WARM", 0.0, "COLD", 0.0, "UNKNOWN", 0.0),
                0.0, 0.0, 0.0, 0.0, 0.0, 0, lotteryConfigId, emptyImprovement);
    }
    
    /**
     * Enhanced quality metrics that combine traditional and TemplateMatrix analysis.
     */
    public static class EnhancedQualityMetrics {
        private final QualityMetrics traditionalMetrics;
        private final TemplateMatrixQualityMetrics templateMetrics;
        private final double enhancedQualityScore;
        private final String enhancedQualityGrade;
        private final QualityImprovementAnalysis improvementAnalysis;
        
        public EnhancedQualityMetrics(QualityMetrics traditionalMetrics,
                                    TemplateMatrixQualityMetrics templateMetrics,
                                    double enhancedQualityScore,
                                    String enhancedQualityGrade,
                                    QualityImprovementAnalysis improvementAnalysis) {
            this.traditionalMetrics = traditionalMetrics;
            this.templateMetrics = templateMetrics;
            this.enhancedQualityScore = enhancedQualityScore;
            this.enhancedQualityGrade = enhancedQualityGrade;
            this.improvementAnalysis = improvementAnalysis;
        }
        
        // Getters
        public QualityMetrics getTraditionalMetrics() { return traditionalMetrics; }
        public TemplateMatrixQualityMetrics getTemplateMetrics() { return templateMetrics; }
        public double getEnhancedQualityScore() { return enhancedQualityScore; }
        public String getEnhancedQualityGrade() { return enhancedQualityGrade; }
        public QualityImprovementAnalysis getImprovementAnalysis() { return improvementAnalysis; }
        
        /**
         * Checks if TemplateMatrix analysis is available.
         */
        public boolean hasTemplateMatrixAnalysis() {
            return templateMetrics != null;
        }
        
        /**
         * Gets the best available quality score (enhanced if available, traditional otherwise).
         */
        public double getBestQualityScore() {
            return hasTemplateMatrixAnalysis() ? enhancedQualityScore : traditionalMetrics.getOptimizationScore();
        }
        
        /**
         * Gets the best available quality grade.
         */
        public String getBestQualityGrade() {
            return hasTemplateMatrixAnalysis() ? enhancedQualityGrade : traditionalMetrics.getQualityGrade();
        }
        
        /**
         * Gets a comprehensive summary including both traditional and template metrics.
         */
        public String getComprehensiveSummary() {
            StringBuilder summary = new StringBuilder();
            summary.append(String.format("Enhanced Quality: %s (%.1f%%) - %d tickets analyzed\n",
                    getBestQualityGrade(), getBestQualityScore(), traditionalMetrics.getTotalTicketsAnalyzed()));
            
            summary.append(String.format("Traditional: %.1f%% with %.1f%% HOT patterns\n",
                    traditionalMetrics.getOptimizationScore(), traditionalMetrics.getHotPatternPercentage()));
            
            if (hasTemplateMatrixAnalysis()) {
                summary.append(String.format("TemplateMatrix: %s with %.1f%% BEST templates, %.1f%% coverage\n",
                        templateMetrics.getTemplateSummary(), templateMetrics.getBestTemplatePercentage(), 
                        templateMetrics.getTemplateCoveragePercentage()));
                
                if (improvementAnalysis.isSignificantImprovement()) {
                    summary.append(String.format("Improvement: %.1f%% - %s\n",
                            improvementAnalysis.getImprovementPercentage(), 
                            improvementAnalysis.getDescription()));
                }
            }
            
            return summary.toString();
        }
        
        @Override
        public String toString() {
            return String.format("EnhancedQualityMetrics{score=%.1f, grade=%s, hasTemplate=%b}",
                    getBestQualityScore(), getBestQualityGrade(), hasTemplateMatrixAnalysis());
        }
    }
    
    /**
     * Analysis of quality improvement provided by TemplateMatrix integration.
     */
    public static class QualityImprovementAnalysis {
        private final double improvementPercentage;
        private final String description;
        private final boolean significantImprovement;
        
        public QualityImprovementAnalysis(double improvementPercentage, String description, boolean significantImprovement) {
            this.improvementPercentage = improvementPercentage;
            this.description = description;
            this.significantImprovement = significantImprovement;
        }
        
        public double getImprovementPercentage() { return improvementPercentage; }
        public String getDescription() { return description; }
        public boolean isSignificantImprovement() { return significantImprovement; }
        
        @Override
        public String toString() {
            return String.format("QualityImprovement{%.1f%%: %s%s}",
                    improvementPercentage, description, significantImprovement ? " [SIGNIFICANT]" : "");
        }
    }
}