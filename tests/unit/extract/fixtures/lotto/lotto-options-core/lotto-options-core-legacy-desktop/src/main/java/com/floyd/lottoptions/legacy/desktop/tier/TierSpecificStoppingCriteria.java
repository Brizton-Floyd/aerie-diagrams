package com.floyd.lottoptions.legacy.desktop.tier;

import com.floyd.lottoptions.legacy.desktop.generation.criteria.StoppingCriteria;
import com.floyd.lottoptions.legacy.desktop.quality.QualityMetrics;

/**
 * Enhanced stopping criteria that integrates tier-specific optimization
 * with existing stopping criteria logic. Preserves all current functionality
 * while adding tier-aware decision making.
 */
public class TierSpecificStoppingCriteria {
    
    private final StoppingCriteria baseCriteria;
    private final TierOptimizationStrategy tierStrategy;
    
    public TierSpecificStoppingCriteria(StoppingCriteria baseCriteria, 
                                        TierOptimizationStrategy tierStrategy) {
        this.baseCriteria = baseCriteria;
        this.tierStrategy = tierStrategy;
    }
    
    /**
     * Evaluates stopping criteria with tier-specific logic layered on top
     * of existing criteria. Preserves all current stopping behavior.
     */
    public boolean shouldStop(QualityMetrics currentMetrics, int ticketsGenerated, 
                              int totalAttempts, long elapsedTime) {
        
        // First check existing base criteria - preserve all current logic
        boolean baseStop = evaluateBaseCriteria(currentMetrics, ticketsGenerated, totalAttempts, elapsedTime);
        
        if (baseStop) {
            return true; // Honor existing stopping decisions
        }
        
        // Add tier-specific stopping logic as additional layer
        return evaluateTierSpecificCriteria(currentMetrics, ticketsGenerated);
    }
    
    /**
     * Evaluates existing stopping criteria logic - unchanged behavior.
     */
    private boolean evaluateBaseCriteria(QualityMetrics metrics, int ticketsGenerated, 
                                         int totalAttempts, long elapsedTime) {
        
        // Pattern coverage criteria
        if (metrics.getHotPatternPercentage() >= baseCriteria.getHotPatternCoverageThreshold() &&
            metrics.getWarmPatternPercentage() >= baseCriteria.getWarmPatternCoverageThreshold()) {
            return true;
        }
        
        // Quality score criteria
        if (metrics.getOptimizationScore() >= baseCriteria.getOptimizationScoreThreshold()) {
            return true;
        }
        
        // Coverage criteria
        if (metrics.getCoveragePercentage() >= baseCriteria.getCoveragePercentageThreshold()) {
            return true;
        }
        
        // Budget limit
        if (ticketsGenerated >= baseCriteria.getBudgetLimit()) {
            return true;
        }
        
        // Time and attempt limits
        if (totalAttempts >= baseCriteria.getMaxAttempts() || elapsedTime >= baseCriteria.getTimeoutMillis()) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Evaluates tier-specific stopping criteria as additional layer.
     */
    private boolean evaluateTierSpecificCriteria(QualityMetrics metrics, int ticketsGenerated) {
        if (tierStrategy == null) {
            return false; // No tier-specific logic if no strategy
        }
        
        // Get tier-specific performance score
        double tierPerformance = calculateTierPerformance(metrics);
        
        // Use tier strategy's stopping criteria
        return tierStrategy.shouldStopGeneration(
                tierPerformance, 
                ticketsGenerated, 
                (int) baseCriteria.getBudgetLimit()
        );
    }
    
    /**
     * Calculates tier-specific performance score from quality metrics.
     */
    private double calculateTierPerformance(QualityMetrics metrics) {
        // Combine multiple quality factors into tier-specific score
        double baseScore = metrics.getOptimizationScore();
        
        // Tier-specific adjustments
        switch (tierStrategy.getTierLevel()) {
            case 3: // Tier 3 - prioritize hot patterns and high optimization
                return baseScore * 0.7 + metrics.getHotPatternPercentage() * 0.3;
                
            case 4: // Tier 4 - balance hot/warm patterns  
                return baseScore * 0.5 + 
                       (metrics.getHotPatternPercentage() + metrics.getWarmPatternPercentage()) * 0.25;
                
            case 5: // Tier 5 - prioritize coverage and consistency
                return baseScore * 0.4 + metrics.getCoveragePercentage() * 0.4 + 
                       metrics.getUniquenessScore() * 0.2;
                
            default:
                return baseScore; // Fallback to base score
        }
    }
    
    /**
     * Gets the underlying base criteria for access to existing thresholds.
     */
    public StoppingCriteria getBaseCriteria() {
        return baseCriteria;
    }
    
    /**
     * Gets the tier optimization strategy.
     */
    public TierOptimizationStrategy getTierStrategy() {
        return tierStrategy;
    }
    
    /**
     * Provides detailed stopping reason for logging and debugging.
     */
    public String getStoppingReason(QualityMetrics metrics, int ticketsGenerated, 
                                    int totalAttempts, long elapsedTime) {
        
        if (evaluateBaseCriteria(metrics, ticketsGenerated, totalAttempts, elapsedTime)) {
            // Identify which base criteria triggered stopping
            if (metrics.getOptimizationScore() >= baseCriteria.getOptimizationScoreThreshold()) {
                return "Base optimization score threshold met: " + metrics.getOptimizationScore();
            }
            if (ticketsGenerated >= baseCriteria.getBudgetLimit()) {
                return "Budget limit reached: " + ticketsGenerated + " tickets";
            }
            if (totalAttempts >= baseCriteria.getMaxAttempts()) {
                return "Maximum attempts reached: " + totalAttempts;
            }
            return "Base stopping criteria met";
        }
        
        if (evaluateTierSpecificCriteria(metrics, ticketsGenerated)) {
            double tierPerformance = calculateTierPerformance(metrics);
            return "Tier " + tierStrategy.getTierLevel() + " performance threshold met: " + 
                   String.format("%.1f%%", tierPerformance);
        }
        
        return "Continuing generation";
    }
}