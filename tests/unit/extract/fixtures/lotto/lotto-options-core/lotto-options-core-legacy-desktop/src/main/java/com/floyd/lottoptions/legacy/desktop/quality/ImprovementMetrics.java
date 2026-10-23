package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.util.NumberFormatter;

/**
 * Data class representing improvement metrics comparing generated tickets
 * to random baseline performance for achieving the 20% improvement target.
 */
public class ImprovementMetrics {
    
    private final double generatedPerformance;
    private final double baselinePerformance;
    private final double improvementPercentage;
    private final boolean twentyPercentTargetMet;
    private final String targetTier;
    
    public ImprovementMetrics(double generatedPerformance, double baselinePerformance,
                             double improvementPercentage, boolean twentyPercentTargetMet,
                             String targetTier) {
        this.generatedPerformance = generatedPerformance;
        this.baselinePerformance = baselinePerformance;
        this.improvementPercentage = improvementPercentage;
        this.twentyPercentTargetMet = twentyPercentTargetMet;
        this.targetTier = targetTier;
    }
    
    public double getGeneratedPerformance() {
        return NumberFormatter.formatToTwoDecimals(generatedPerformance);
    }
    
    public double getBaselinePerformance() {
        return NumberFormatter.formatToTwoDecimals(baselinePerformance);
    }
    
    public double getImprovementPercentage() {
        return NumberFormatter.formatToTwoDecimals(improvementPercentage);
    }
    
    public boolean isTwentyPercentTargetMet() {
        return twentyPercentTargetMet;
    }
    
    public String getTargetTier() {
        return targetTier;
    }
    
    @Override
    public String toString() {
        return String.format("ImprovementMetrics{tier=%s, improvement=%.1f%%, target=%s}",
                targetTier, improvementPercentage, twentyPercentTargetMet ? "MET" : "NOT MET");
    }
}