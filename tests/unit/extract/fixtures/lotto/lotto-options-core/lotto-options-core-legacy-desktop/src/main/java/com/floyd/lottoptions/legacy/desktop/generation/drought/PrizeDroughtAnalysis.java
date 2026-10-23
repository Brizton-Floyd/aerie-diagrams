package com.floyd.lottoptions.legacy.desktop.generation.drought;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Contains comprehensive drought analysis results for all prize tiers
 * in a lottery game. Provides targeting recommendations and severity scores.
 */
public class PrizeDroughtAnalysis {
    
    private final Map<String, PrizeTierDrought> prizeTierDroughts;
    private final Map<String, Double> targetingWeights;
    private final double overallDroughtScore;
    private final String lotteryConfigId;
    private final LocalDate analysisDate;
    
    public PrizeDroughtAnalysis(Map<String, PrizeTierDrought> prizeTierDroughts,
                               Map<String, Double> targetingWeights,
                               double overallDroughtScore,
                               String lotteryConfigId,
                               LocalDate analysisDate) {
        this.prizeTierDroughts = prizeTierDroughts;
        this.targetingWeights = targetingWeights;
        this.overallDroughtScore = overallDroughtScore;
        this.lotteryConfigId = lotteryConfigId;
        this.analysisDate = analysisDate;
    }
    
    /**
     * Gets drought analysis for all prize tiers.
     */
    public Map<String, PrizeTierDrought> getPrizeTierDroughts() {
        return prizeTierDroughts;
    }
    
    /**
     * Gets targeting weights for number generation (higher = prioritize this prize tier).
     */
    public Map<String, Double> getTargetingWeights() {
        return targetingWeights;
    }
    
    /**
     * Gets overall drought severity score across all prize tiers.
     */
    public double getOverallDroughtScore() {
        return overallDroughtScore;
    }
    
    /**
     * Gets the lottery configuration ID this analysis applies to.
     */
    public String getLotteryConfigId() {
        return lotteryConfigId;
    }
    
    /**
     * Gets the date when this analysis was performed.
     */
    public LocalDate getAnalysisDate() {
        return analysisDate;
    }
    
    /**
     * Gets a list of prize tiers currently in drought condition.
     */
    public List<PrizeTierDrought> getDroughtPrizeTiers() {
        return prizeTierDroughts.values().stream()
            .filter(PrizeTierDrought::isInDrought)
            .collect(Collectors.toList());
    }
    
    /**
     * Gets the prize tier with the highest targeting weight (most recommended to target).
     */
    public String getHighestPriorityPrizeTier() {
        return targetingWeights.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("match4"); // Default to match4
    }
    
    /**
     * Returns true if any prize tier is currently in drought condition.
     */
    public boolean hasActiveDroughts() {
        return prizeTierDroughts.values().stream()
            .anyMatch(PrizeTierDrought::isInDrought);
    }
    
    /**
     * Gets drought analysis for a specific prize tier.
     */
    public PrizeTierDrought getPrizeTierDrought(String prizeKey) {
        return prizeTierDroughts.get(prizeKey);
    }
    
    /**
     * Gets targeting weight for a specific prize tier.
     */
    public double getTargetingWeight(String prizeKey) {
        return targetingWeights.getOrDefault(prizeKey, 1.0);
    }
    
    /**
     * Gets a summary of drought conditions for logging/debugging.
     */
    public String getDroughtSummary() {
        List<PrizeTierDrought> droughts = getDroughtPrizeTiers();
        
        if (droughts.isEmpty()) {
            return "No active droughts detected";
        }
        
        String droughtList = droughts.stream()
            .map(d -> String.format("%s (%.1fx overdue)", d.getPrizeTier(), d.getDroughtSeverity()))
            .collect(Collectors.joining(", "));
        
        return String.format("Active droughts: %s | Priority target: %s", 
                           droughtList, getHighestPriorityPrizeTier());
    }
    
    /**
     * Gets strategic recommendations based on drought analysis.
     */
    public String getStrategicRecommendations() {
        if (!hasActiveDroughts()) {
            return "No immediate drought concerns. Use standard generation strategies.";
        }
        
        String highestPriority = getHighestPriorityPrizeTier();
        double priorityWeight = getTargetingWeight(highestPriority);
        
        return String.format("Focus on %s patterns (%.1fx weight). Consider number combinations that historically produced this prize tier.", 
                           highestPriority, priorityWeight);
    }
    
    @Override
    public String toString() {
        return String.format("PrizeDroughtAnalysis{config='%s', droughts=%d, overallScore=%.2f, topPriority='%s'}", 
                           lotteryConfigId, getDroughtPrizeTiers().size(), overallDroughtScore, getHighestPriorityPrizeTier());
    }
}