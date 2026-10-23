package com.floyd.lottoptions.legacy.desktop.generation.performance;

import java.time.LocalDate;
import java.util.*;

/**
 * Tracks performance statistics for a specific pattern across different prize tiers.
 * This class accumulates data about how often a pattern appears and what prizes it produces.
 */
public class PrizeTierPatternStats {
    
    private final String pattern;
    private final String lotteryConfigId;
    private final Map<String, Integer> prizeTierCounts;
    private final Map<String, Double> prizeTierValues;
    private final List<LocalDate> occurrenceDates;
    private final Set<String> performanceBonuses;
    private int totalOccurrences;
    
    public PrizeTierPatternStats(String pattern, String lotteryConfigId) {
        this.pattern = pattern;
        this.lotteryConfigId = lotteryConfigId;
        this.prizeTierCounts = new HashMap<>();
        this.prizeTierValues = new HashMap<>();
        this.occurrenceDates = new ArrayList<>();
        this.performanceBonuses = new HashSet<>();
        this.totalOccurrences = 0;
        
        // Initialize all prize tiers
        initializePrizeTiers();
    }
    
    private void initializePrizeTiers() {
        String[] tiers = {"jackpot", "match5", "match4", "match3"};
        for (String tier : tiers) {
            prizeTierCounts.put(tier, 0);
            prizeTierValues.put(tier, 0.0);
        }
    }
    
    /**
     * Records that this pattern occurred in a historical draw.
     */
    public void recordDrawOccurrence(LocalDate drawDate) {
        totalOccurrences++;
        if (drawDate != null) {
            occurrenceDates.add(drawDate);
        }
    }
    
    /**
     * Records that this pattern produced a specific prize outcome.
     */
    public void recordPrizeOutcome(String prizeTier, double prizeValue) {
        if (prizeTierCounts.containsKey(prizeTier)) {
            prizeTierCounts.put(prizeTier, prizeTierCounts.get(prizeTier) + 1);
            prizeTierValues.put(prizeTier, prizeTierValues.get(prizeTier) + prizeValue);
        }
    }
    
    /**
     * Adds a performance bonus for patterns with special characteristics.
     */
    public void addPerformanceBonus(String bonusType) {
        performanceBonuses.add(bonusType);
    }
    
    /**
     * Gets the performance score for a specific prize tier.
     * Higher scores indicate better historical performance for that tier.
     */
    public double getPrizeTierScore(String prizeTier) {
        if (!prizeTierCounts.containsKey(prizeTier)) {
            return 0.0;
        }
        
        int count = prizeTierCounts.get(prizeTier);
        double totalValue = prizeTierValues.get(prizeTier);
        
        if (count == 0) {
            return 0.0;
        }
        
        // Base score: frequency of this prize tier for this pattern
        double baseScore = (double) count / Math.max(1, totalOccurrences);
        
        // Value bonus: higher value prizes get higher scores
        double valueBonus = totalValue / Math.max(1.0, totalValue + 1000.0);
        
        // Performance bonus: patterns with special characteristics get bonus
        double bonusMultiplier = 1.0 + (performanceBonuses.size() * 0.1);
        
        return (baseScore + valueBonus) * bonusMultiplier;
    }
    
    /**
     * Gets the total prize value produced by this pattern across all tiers.
     */
    public double getTotalPrizeValue() {
        return prizeTierValues.values().stream().mapToDouble(Double::doubleValue).sum();
    }
    
    /**
     * Gets the total number of times this pattern has occurred.
     */
    public int getTotalOccurrences() {
        return totalOccurrences;
    }
    
    /**
     * Gets the versatility score - how well this pattern performs across multiple tiers.
     */
    public double getVersatilityScore() {
        int tiersWithWins = (int) prizeTierCounts.values().stream().mapToInt(Integer::intValue).filter(count -> count > 0).count();
        return (double) tiersWithWins / prizeTierCounts.size();
    }
    
    /**
     * Gets the frequency of this pattern producing a specific prize tier.
     */
    public double getPrizeTierFrequency(String prizeTier) {
        if (!prizeTierCounts.containsKey(prizeTier) || totalOccurrences == 0) {
            return 0.0;
        }
        return (double) prizeTierCounts.get(prizeTier) / totalOccurrences;
    }
    
    /**
     * Gets the average prize value per occurrence for a specific tier.
     */
    public double getAveragePrizeValue(String prizeTier) {
        if (!prizeTierCounts.containsKey(prizeTier)) {
            return 0.0;
        }
        
        int count = prizeTierCounts.get(prizeTier);
        double totalValue = prizeTierValues.get(prizeTier);
        
        return count > 0 ? totalValue / count : 0.0;
    }
    
    /**
     * Gets the most recent occurrence date of this pattern.
     */
    public Optional<LocalDate> getMostRecentOccurrence() {
        return occurrenceDates.stream().max(LocalDate::compareTo);
    }
    
    /**
     * Gets the oldest occurrence date of this pattern.
     */
    public Optional<LocalDate> getOldestOccurrence() {
        return occurrenceDates.stream().min(LocalDate::compareTo);
    }
    
    /**
     * Gets summary statistics for this pattern.
     */
    public PatternSummary getSummary() {
        return new PatternSummary(
            pattern,
            totalOccurrences,
            getTotalPrizeValue(),
            getVersatilityScore(),
            getMostRecentOccurrence().orElse(null),
            getBestPerformingTier()
        );
    }
    
    /**
     * Gets the prize tier where this pattern performs best.
     */
    public String getBestPerformingTier() {
        return prizeTierCounts.entrySet().stream()
            .filter(e -> e.getValue() > 0)
            .max(Comparator.comparing(e -> getPrizeTierScore(e.getKey())))
            .map(Map.Entry::getKey)
            .orElse("none");
    }
    
    // Getters
    public String getPattern() { return pattern; }
    public String getLotteryConfigId() { return lotteryConfigId; }
    public Map<String, Integer> getPrizeTierCounts() { return new HashMap<>(prizeTierCounts); }
    public Map<String, Double> getPrizeTierValues() { return new HashMap<>(prizeTierValues); }
    public Set<String> getPerformanceBonuses() { return new HashSet<>(performanceBonuses); }
    
    @Override
    public String toString() {
        return String.format("PrizeTierPatternStats{pattern='%s', occurrences=%d, totalValue=%.2f, versatility=%.2f}", 
                           pattern, totalOccurrences, getTotalPrizeValue(), getVersatilityScore());
    }
    
    /**
     * Summary class for pattern statistics.
     */
    public static class PatternSummary {
        private final String pattern;
        private final int totalOccurrences;
        private final double totalPrizeValue;
        private final double versatilityScore;
        private final LocalDate mostRecentOccurrence;
        private final String bestPerformingTier;
        
        public PatternSummary(String pattern, int totalOccurrences, double totalPrizeValue, 
                            double versatilityScore, LocalDate mostRecentOccurrence, String bestPerformingTier) {
            this.pattern = pattern;
            this.totalOccurrences = totalOccurrences;
            this.totalPrizeValue = totalPrizeValue;
            this.versatilityScore = versatilityScore;
            this.mostRecentOccurrence = mostRecentOccurrence;
            this.bestPerformingTier = bestPerformingTier;
        }
        
        // Getters
        public String getPattern() { return pattern; }
        public int getTotalOccurrences() { return totalOccurrences; }
        public double getTotalPrizeValue() { return totalPrizeValue; }
        public double getVersatilityScore() { return versatilityScore; }
        public LocalDate getMostRecentOccurrence() { return mostRecentOccurrence; }
        public String getBestPerformingTier() { return bestPerformingTier; }
        
        @Override
        public String toString() {
            return String.format("Pattern %s: %d occurrences, $%.2f total, %.2f versatility, best tier: %s", 
                               pattern, totalOccurrences, totalPrizeValue, versatilityScore, bestPerformingTier);
        }
    }
}