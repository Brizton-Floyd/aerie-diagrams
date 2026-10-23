package com.floyd.lottoptions.legacy.desktop.tier;

import java.util.List;
import java.util.Map;

/**
 * Strategy interface for optimizing lottery number generation for specific prize tiers.
 * Each tier represents a different number of matches (Tier 3 = 5 matches, Tier 4 = 4 matches, etc.)
 */
public interface TierOptimizationStrategy {
    
    /**
     * Gets the tier level this strategy optimizes for.
     * @return The tier level (3, 4, or 5)
     */
    int getTierLevel();
    
    /**
     * Gets the number of matches required for this tier.
     * @return Number of matches needed to win this tier
     */
    int getRequiredMatches();
    
    /**
     * Gets the priority level for this tier (higher = more important).
     * @return Priority level (1-10 scale)
     */
    int getPriority();
    
    /**
     * Optimizes number selection for this specific tier.
     * 
     * @param candidateNumbers Available numbers to choose from
     * @param numbersToSelect How many numbers to select
     * @param historicalFrequencies Number frequency data
     * @param recentDraws Recent draw history for pattern analysis
     * @return Optimized number selection for this tier
     */
    List<Integer> optimizeForTier(List<Integer> candidateNumbers, 
                                  int numbersToSelect,
                                  Map<Integer, Double> historicalFrequencies,
                                  List<int[]> recentDraws);
    
    /**
     * Evaluates how well a ticket set performs for this tier.
     * 
     * @param tickets Generated tickets to evaluate
     * @param historicalFrequencies Number frequency data
     * @param recentDraws Recent draw history
     * @return Tier-specific performance score (0.0 to 100.0)
     */
    double evaluateTierPerformance(List<int[]> tickets,
                                   Map<Integer, Double> historicalFrequencies,
                                   List<int[]> recentDraws);
    
    /**
     * Determines if the generation should stop based on tier-specific criteria.
     * 
     * @param currentPerformance Current tier performance score
     * @param ticketsGenerated Number of tickets generated so far
     * @param budget Maximum budget/ticket limit
     * @return true if stopping criteria met for this tier
     */
    boolean shouldStopGeneration(double currentPerformance, int ticketsGenerated, int budget);
    
    /**
     * Gets the tier name for logging and display purposes.
     * @return Human-readable tier name
     */
    default String getTierName() {
        return "Tier " + getTierLevel() + " (" + getRequiredMatches() + " matches)";
    }
}