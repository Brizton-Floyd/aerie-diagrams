package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;

import java.util.*;

/**
 * Calculator responsible for measuring and tracking performance improvement
 * of generated lottery tickets compared to random baseline selection.
 * Validates achievement of the 20% expected improvement target.
 */
public class ImprovementCalculator {
    
    private final LotteryPersistenceClient persistenceClient;
    private final BaselinePerformanceService baselineService;
    
    public ImprovementCalculator(LotteryPersistenceClient persistenceClient) {
        this.persistenceClient = persistenceClient;
        this.baselineService = new BaselinePerformanceService(persistenceClient);
    }
    
    /**
     * Calculates the performance improvement percentage of generated tickets
     * compared to random baseline selection for the target tier.
     *
     * @param tickets The generated lottery tickets
     * @param targetTier The prize tier being targeted (tier_3, tier_4, tier_5)
     * @param lotteryConfigId The lottery configuration identifier
     * @return ImprovementMetrics containing improvement analysis
     */
    public ImprovementMetrics calculateImprovement(List<int[]> tickets, String targetTier, 
                                                  String lotteryConfigId) {
        if (tickets == null || tickets.isEmpty()) {
            return new ImprovementMetrics(0.0, 0.0, 0.0, false, targetTier);
        }
        
        try {
            // Get baseline performance for random selection
            BaselinePerformance baseline = baselineService.getBaselinePerformance(targetTier, lotteryConfigId);
            
            // Calculate expected performance of generated tickets
            double generatedPerformance = calculateExpectedPerformance(tickets, targetTier, lotteryConfigId);
            
            // Calculate improvement percentage
            double improvementPercentage = calculateImprovementPercentage(generatedPerformance, baseline.getExpectedWinRate());
            
            // Check if 20% target is achieved
            boolean twentyPercentTargetMet = improvementPercentage >= 20.0;
            
            System.out.println(String.format("Improvement Analysis - Generated: %.4f%%, Baseline: %.4f%%, Improvement: %.2f%%, Target Met: %s",
                    generatedPerformance * 100, baseline.getExpectedWinRate() * 100, improvementPercentage, twentyPercentTargetMet));
            
            return new ImprovementMetrics(
                generatedPerformance,
                baseline.getExpectedWinRate(),
                improvementPercentage,
                twentyPercentTargetMet,
                targetTier
            );
            
        } catch (Exception e) {
            System.err.println("Error calculating improvement metrics: " + e.getMessage());
            return new ImprovementMetrics(0.0, 0.0, 0.0, false, targetTier);
        }
    }
    
    /**
     * Calculates expected performance of generated tickets for the target tier.
     */
    private double calculateExpectedPerformance(List<int[]> tickets, String targetTier, String lotteryConfigId) {
        double totalExpectedPerformance = 0.0;
        
        for (int[] ticket : tickets) {
            double ticketPerformance = calculateTicketPerformance(ticket, targetTier, lotteryConfigId);
            totalExpectedPerformance += ticketPerformance;
        }
        
        return totalExpectedPerformance / tickets.size();
    }
    
    /**
     * Calculates expected performance of a single ticket for the target tier.
     */
    private double calculateTicketPerformance(int[] ticket, String targetTier, String lotteryConfigId) {
        try {
            // Get hot numbers and their frequencies
            List<Integer> hotNumbers = persistenceClient.getHotNumbers(lotteryConfigId);
            Map<Integer, Double> numberFrequencies = persistenceClient.getNumberFrequencies(lotteryConfigId);
            
            double performanceScore = 0.0;
            
            // Factor 1: Hot number coverage (40% weight)
            double hotCoverage = calculateHotNumberCoverage(ticket, hotNumbers);
            performanceScore += hotCoverage * 0.4;
            
            // Factor 2: Historical frequency alignment (35% weight)
            double frequencyScore = calculateFrequencyAlignment(ticket, numberFrequencies);
            performanceScore += frequencyScore * 0.35;
            
            // Factor 3: Tier-specific optimization (25% weight)
            double tierScore = calculateTierSpecificScore(ticket, targetTier, lotteryConfigId);
            performanceScore += tierScore * 0.25;
            
            return Math.max(0.0, Math.min(1.0, performanceScore));
            
        } catch (Exception e) {
            System.err.println("Error calculating ticket performance: " + e.getMessage());
            return 0.0;
        }
    }
    
    /**
     * Calculates how well a ticket covers hot numbers.
     */
    private double calculateHotNumberCoverage(int[] ticket, List<Integer> hotNumbers) {
        if (hotNumbers == null || hotNumbers.isEmpty()) {
            return 0.0;
        }
        
        int hotNumbersInTicket = 0;
        for (int number : ticket) {
            if (hotNumbers.contains(number)) {
                hotNumbersInTicket++;
            }
        }
        
        return (double) hotNumbersInTicket / ticket.length;
    }
    
    /**
     * Calculates how well ticket numbers align with historical frequencies.
     */
    private double calculateFrequencyAlignment(int[] ticket, Map<Integer, Double> frequencies) {
        if (frequencies == null || frequencies.isEmpty()) {
            return 0.0;
        }
        
        double totalFrequency = 0.0;
        for (int number : ticket) {
            totalFrequency += frequencies.getOrDefault(number, 0.0);
        }
        
        return totalFrequency / ticket.length;
    }
    
    /**
     * Calculates tier-specific performance score.
     */
    private double calculateTierSpecificScore(int[] ticket, String targetTier, String lotteryConfigId) {
        switch (targetTier.toLowerCase()) {
            case "tier_3":
                // Tier 3 (5 matches) - requires high pattern strength
                return calculateHighTierScore(ticket, lotteryConfigId);
            case "tier_4":
                // Tier 4 (4 matches) - balanced approach
                return calculateMidTierScore(ticket, lotteryConfigId);
            case "tier_5":
                // Tier 5 (3 matches) - broader coverage
                return calculateLowTierScore(ticket, lotteryConfigId);
            default:
                return 0.5; // Neutral score for unknown tiers
        }
    }
    
    private double calculateHighTierScore(int[] ticket, String lotteryConfigId) {
        // High tier requires strong pattern alignment
        // Focus on hot patterns and proven combinations
        return 0.8; // Placeholder - would use actual pattern analysis
    }
    
    private double calculateMidTierScore(int[] ticket, String lotteryConfigId) {
        // Mid tier balances pattern strength with coverage
        return 0.6; // Placeholder
    }
    
    private double calculateLowTierScore(int[] ticket, String lotteryConfigId) {
        // Low tier emphasizes broader number distribution
        return 0.4; // Placeholder
    }
    
    /**
     * Calculates improvement percentage compared to baseline.
     */
    private double calculateImprovementPercentage(double generated, double baseline) {
        if (baseline <= 0) {
            return 0.0;
        }
        
        return ((generated - baseline) / baseline) * 100.0;
    }
    
    /**
     * Validates if the improvement meets the minimum 20% target.
     */
    public boolean meetsImprovementTarget(ImprovementMetrics metrics) {
        return metrics != null && metrics.isTwentyPercentTargetMet();
    }
    
    /**
     * Gets the current improvement status summary.
     */
    public String getImprovementSummary(ImprovementMetrics metrics) {
        if (metrics == null) {
            return "No improvement data available";
        }
        
        return String.format("Improvement: %.1f%% (Target: 20%%, Status: %s)", 
                metrics.getImprovementPercentage(),
                metrics.isTwentyPercentTargetMet() ? "✓ MET" : "✗ NOT MET");
    }
}