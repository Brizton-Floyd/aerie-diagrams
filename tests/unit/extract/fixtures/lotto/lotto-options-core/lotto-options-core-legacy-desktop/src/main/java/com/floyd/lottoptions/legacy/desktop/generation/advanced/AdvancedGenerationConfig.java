package com.floyd.lottoptions.legacy.desktop.generation.advanced;

/**
 * Configuration settings for the Advanced Generation Engine.
 * Allows fine-tuning of generation behavior and optimization parameters.
 */
public class AdvancedGenerationConfig {
    
    // Generation parameters
    private int maxAttempts = 10000;
    private double duplicateThreshold = 0.3; // Max acceptable duplicate rate
    private double failureThreshold = 0.2;   // Max acceptable failure rate
    private boolean enableRealTimeAdaptation = true;
    private boolean enablePostOptimization = true;
    
    // Quality parameters  
    private double minimumEfficiencyScore = 0.6;
    private boolean requireBalancedDistribution = true;
    private boolean avoidCommonPatterns = true;
    private boolean ensureNumberSpread = true;
    
    // Performance parameters
    private int progressUpdateInterval = 10; // Update every N tickets
    private boolean enablePerformanceLogging = true;
    private boolean enableFallbackGeneration = true;
    
    // Strategy parameters
    private double droughtWeightMultiplier = 1.5;
    private double patternSuccessThreshold = 0.3;
    private int maxTopPatternsToUse = 5;
    private boolean enableCombinedIntelligence = true;
    
    public AdvancedGenerationConfig() {
        // Default configuration
    }
    
    /**
     * Creates a configuration optimized for performance.
     */
    public static AdvancedGenerationConfig forPerformance() {
        AdvancedGenerationConfig config = new AdvancedGenerationConfig();
        config.maxAttempts = 5000;
        config.enableRealTimeAdaptation = false;
        config.enablePostOptimization = false;
        config.progressUpdateInterval = 50;
        config.enablePerformanceLogging = false;
        return config;
    }
    
    /**
     * Creates a configuration optimized for quality.
     */
    public static AdvancedGenerationConfig forQuality() {
        AdvancedGenerationConfig config = new AdvancedGenerationConfig();
        config.maxAttempts = 20000;
        config.duplicateThreshold = 0.1;
        config.failureThreshold = 0.1;
        config.minimumEfficiencyScore = 0.8;
        config.enableRealTimeAdaptation = true;
        config.enablePostOptimization = true;
        return config;
    }
    
    /**
     * Creates a configuration balanced between performance and quality.
     */
    public static AdvancedGenerationConfig balanced() {
        return new AdvancedGenerationConfig(); // Default is balanced
    }
    
    /**
     * Validates the configuration settings.
     */
    public boolean isValid() {
        return maxAttempts > 0 &&
               duplicateThreshold >= 0.0 && duplicateThreshold <= 1.0 &&
               failureThreshold >= 0.0 && failureThreshold <= 1.0 &&
               minimumEfficiencyScore >= 0.0 && minimumEfficiencyScore <= 1.0 &&
               progressUpdateInterval > 0 &&
               droughtWeightMultiplier >= 1.0 &&
               patternSuccessThreshold >= 0.0 && patternSuccessThreshold <= 1.0 &&
               maxTopPatternsToUse > 0;
    }
    
    /**
     * Gets configuration summary.
     */
    public String getSummary() {
        return String.format(
            "AdvancedGenerationConfig{maxAttempts=%d, efficiency=%.1f%%, adaptation=%s, optimization=%s}",
            maxAttempts,
            minimumEfficiencyScore * 100,
            enableRealTimeAdaptation ? "ON" : "OFF",
            enablePostOptimization ? "ON" : "OFF"
        );
    }
    
    // Getters and Setters
    public int getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }
    
    public double getDuplicateThreshold() { return duplicateThreshold; }
    public void setDuplicateThreshold(double duplicateThreshold) { this.duplicateThreshold = duplicateThreshold; }
    
    public double getFailureThreshold() { return failureThreshold; }
    public void setFailureThreshold(double failureThreshold) { this.failureThreshold = failureThreshold; }
    
    public boolean isEnableRealTimeAdaptation() { return enableRealTimeAdaptation; }
    public void setEnableRealTimeAdaptation(boolean enableRealTimeAdaptation) { this.enableRealTimeAdaptation = enableRealTimeAdaptation; }
    
    public boolean isEnablePostOptimization() { return enablePostOptimization; }
    public void setEnablePostOptimization(boolean enablePostOptimization) { this.enablePostOptimization = enablePostOptimization; }
    
    public double getMinimumEfficiencyScore() { return minimumEfficiencyScore; }
    public void setMinimumEfficiencyScore(double minimumEfficiencyScore) { this.minimumEfficiencyScore = minimumEfficiencyScore; }
    
    public boolean isRequireBalancedDistribution() { return requireBalancedDistribution; }
    public void setRequireBalancedDistribution(boolean requireBalancedDistribution) { this.requireBalancedDistribution = requireBalancedDistribution; }
    
    public boolean isAvoidCommonPatterns() { return avoidCommonPatterns; }
    public void setAvoidCommonPatterns(boolean avoidCommonPatterns) { this.avoidCommonPatterns = avoidCommonPatterns; }
    
    public boolean isEnsureNumberSpread() { return ensureNumberSpread; }
    public void setEnsureNumberSpread(boolean ensureNumberSpread) { this.ensureNumberSpread = ensureNumberSpread; }
    
    public int getProgressUpdateInterval() { return progressUpdateInterval; }
    public void setProgressUpdateInterval(int progressUpdateInterval) { this.progressUpdateInterval = progressUpdateInterval; }
    
    public boolean isEnablePerformanceLogging() { return enablePerformanceLogging; }
    public void setEnablePerformanceLogging(boolean enablePerformanceLogging) { this.enablePerformanceLogging = enablePerformanceLogging; }
    
    public boolean isEnableFallbackGeneration() { return enableFallbackGeneration; }
    public void setEnableFallbackGeneration(boolean enableFallbackGeneration) { this.enableFallbackGeneration = enableFallbackGeneration; }
    
    public double getDroughtWeightMultiplier() { return droughtWeightMultiplier; }
    public void setDroughtWeightMultiplier(double droughtWeightMultiplier) { this.droughtWeightMultiplier = droughtWeightMultiplier; }
    
    public double getPatternSuccessThreshold() { return patternSuccessThreshold; }
    public void setPatternSuccessThreshold(double patternSuccessThreshold) { this.patternSuccessThreshold = patternSuccessThreshold; }
    
    public int getMaxTopPatternsToUse() { return maxTopPatternsToUse; }
    public void setMaxTopPatternsToUse(int maxTopPatternsToUse) { this.maxTopPatternsToUse = maxTopPatternsToUse; }
    
    public boolean isEnableCombinedIntelligence() { return enableCombinedIntelligence; }
    public void setEnableCombinedIntelligence(boolean enableCombinedIntelligence) { this.enableCombinedIntelligence = enableCombinedIntelligence; }
}