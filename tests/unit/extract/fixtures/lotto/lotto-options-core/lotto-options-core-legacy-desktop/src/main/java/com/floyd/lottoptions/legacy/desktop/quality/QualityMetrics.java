package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.util.NumberFormatter;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Represents comprehensive quality metrics for a set of lottery tickets.
 * Contains optimization scores, quality grades, pattern distributions, and detailed analysis.
 */
public class QualityMetrics {
    
    private final double optimizationScore;
    private final String qualityGrade;
    private final Map<String, Double> patternDistribution;
    private final double coveragePercentage;
    private final double consecutiveRate;
    private final double repeatRate;
    private final double uniquenessScore;
    private final double overlapPercentage;
    private final int totalTicketsAnalyzed;
    private final LocalDateTime analysisTimestamp;
    private final String lotteryConfigId;
    private final ImprovementMetrics improvementMetrics;

    /**
     * Constructs QualityMetrics with comprehensive analysis results.
     */
    public QualityMetrics(double optimizationScore, String qualityGrade, Map<String, Double> patternDistribution,
                         double coveragePercentage, double consecutiveRate, double repeatRate,
                         double uniquenessScore, double overlapPercentage, int totalTicketsAnalyzed,
                         String lotteryConfigId, ImprovementMetrics improvementMetrics) {
        this.optimizationScore = optimizationScore;
        this.qualityGrade = qualityGrade;
        this.patternDistribution = patternDistribution;
        this.coveragePercentage = coveragePercentage;
        this.consecutiveRate = consecutiveRate;
        this.repeatRate = repeatRate;
        this.uniquenessScore = uniquenessScore;
        this.overlapPercentage = overlapPercentage;
        this.totalTicketsAnalyzed = totalTicketsAnalyzed;
        this.lotteryConfigId = lotteryConfigId;
        this.improvementMetrics = improvementMetrics;
        this.analysisTimestamp = LocalDateTime.now();
    }

    /**
     * Gets the overall optimization score (0-100).
     *
     * @return The optimization score
     */
    public double getOptimizationScore() {
        return NumberFormatter.formatToTwoDecimals(optimizationScore);
    }

    /**
     * Gets the quality grade (A-F).
     *
     * @return The quality grade
     */
    public String getQualityGrade() {
        return qualityGrade;
    }

    /**
     * Gets the pattern distribution percentages.
     *
     * @return Map with HOT, WARM, COLD percentages
     */
    public Map<String, Double> getPatternDistribution() {
        return NumberFormatter.formatMapValues(patternDistribution);
    }

    /**
     * Gets the coverage percentage of unique numbers across all tickets.
     *
     * @return The coverage percentage (0-100)
     */
    public double getCoveragePercentage() {
        return NumberFormatter.formatToTwoDecimals(coveragePercentage);
    }

    /**
     * Gets the rate of consecutive numbers in tickets.
     *
     * @return The consecutive rate (0-100)
     */
    public double getConsecutiveRate() {
        return NumberFormatter.formatToTwoDecimals(consecutiveRate);
    }

    /**
     * Gets the rate of repeated numbers from recent draws.
     *
     * @return The repeat rate (0-100)
     */
    public double getRepeatRate() {
        return NumberFormatter.formatToTwoDecimals(repeatRate);
    }

    /**
     * Gets the uniqueness score measuring ticket diversity.
     *
     * @return The uniqueness score (0-100)
     */
    public double getUniquenessScore() {
        return NumberFormatter.formatToTwoDecimals(uniquenessScore);
    }

    /**
     * Gets the overlap percentage between tickets.
     *
     * @return The overlap percentage (0-100)
     */
    public double getOverlapPercentage() {
        return NumberFormatter.formatToTwoDecimals(overlapPercentage);
    }

    /**
     * Gets the total number of tickets analyzed.
     *
     * @return The number of tickets
     */
    public int getTotalTicketsAnalyzed() {
        return totalTicketsAnalyzed;
    }

    /**
     * Gets the lottery configuration ID.
     *
     * @return The lottery configuration ID
     */
    public String getLotteryConfigId() {
        return lotteryConfigId;
    }

    /**
     * Gets the timestamp when this analysis was performed.
     *
     * @return The analysis timestamp
     */
    public LocalDateTime getAnalysisTimestamp() {
        return analysisTimestamp;
    }

    /**
     * Gets the HOT pattern percentage.
     *
     * @return The HOT pattern percentage
     */
    public double getHotPatternPercentage() {
        return NumberFormatter.formatToTwoDecimals(patternDistribution.getOrDefault("HOT", 0.0));
    }

    /**
     * Gets the WARM pattern percentage.
     *
     * @return The WARM pattern percentage
     */
    public double getWarmPatternPercentage() {
        return NumberFormatter.formatToTwoDecimals(patternDistribution.getOrDefault("WARM", 0.0));
    }

    /**
     * Gets the COLD pattern percentage.
     *
     * @return The COLD pattern percentage
     */
    public double getColdPatternPercentage() {
        return NumberFormatter.formatToTwoDecimals(patternDistribution.getOrDefault("COLD", 0.0));
    }

    /**
     * Gets the improvement metrics.
     *
     * @return The improvement metrics
     */
    public ImprovementMetrics getImprovementMetrics() {
        return improvementMetrics;
    }

    /**
     * Checks if the quality metrics indicate high-quality tickets.
     *
     * @return true if optimization score >= 70 and quality grade is A or B
     */
    public boolean isHighQuality() {
        return optimizationScore >= 70.0 && ("A".equals(qualityGrade) || "B".equals(qualityGrade));
    }

    /**
     * Checks if the 20% improvement target is met.
     *
     * @return true if improvement metrics show >= 20% improvement
     */
    public boolean meetsImprovementTarget() {
        return improvementMetrics != null && improvementMetrics.isTwentyPercentTargetMet();
    }

    /**
     * Gets a summary description of the quality analysis.
     *
     * @return A human-readable summary string
     */
    public String getSummary() {
        String improvementInfo = improvementMetrics != null ? 
                String.format(", Improvement: %.1f%% (%s)", improvementMetrics.getImprovementPercentage(),
                        improvementMetrics.isTwentyPercentTargetMet() ? "✓" : "✗") : "";
        return String.format("Quality Grade: %s (%.1f%%) - %d tickets analyzed with %.1f%% HOT patterns, %.1f%% coverage%s",
                qualityGrade, optimizationScore, totalTicketsAnalyzed, getHotPatternPercentage(), coveragePercentage, improvementInfo);
    }

    @Override
    public String toString() {
        return String.format("QualityMetrics{score=%.1f, grade=%s, tickets=%d, hot=%.1f%%, coverage=%.1f%%}",
                optimizationScore, qualityGrade, totalTicketsAnalyzed, getHotPatternPercentage(), coveragePercentage);
    }
}