package com.floyd.lottoptions.legacy.desktop.tier;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Optimizer for Tier 3 prizes (5 matches - second highest prize tier).
 * Focuses on high-frequency numbers and proven winning patterns.
 */
public class Tier3Optimizer implements TierOptimizationStrategy {
    
    private static final int TIER_LEVEL = 3;
    private static final int REQUIRED_MATCHES = 5;
    private static final int PRIORITY = 8; // High priority tier
    
    // Tier 3 optimization parameters
    private static final double HOT_NUMBER_WEIGHT = 0.7;
    private static final double PATTERN_MATCH_WEIGHT = 0.3;
    private static final double PERFORMANCE_THRESHOLD = 75.0;
    private static final int MAX_TICKETS_PER_BUDGET = 50;
    
    @Override
    public int getTierLevel() {
        return TIER_LEVEL;
    }
    
    @Override
    public int getRequiredMatches() {
        return REQUIRED_MATCHES;
    }
    
    @Override
    public int getPriority() {
        return PRIORITY;
    }
    
    @Override
    public List<Integer> optimizeForTier(List<Integer> candidateNumbers, 
                                         int numbersToSelect,
                                         Map<Integer, Double> historicalFrequencies,
                                         List<int[]> recentDraws) {
        if (candidateNumbers == null || candidateNumbers.isEmpty()) {
            return new ArrayList<>();
        }
        
        // Step 1: Score each candidate number for Tier 3 optimization
        Map<Integer, Double> numberScores = new HashMap<>();
        
        for (Integer number : candidateNumbers) {
            double score = calculateTier3Score(number, historicalFrequencies, recentDraws);
            numberScores.put(number, score);
        }
        
        // Step 2: Select top numbers based on Tier 3 scoring
        return numberScores.entrySet().stream()
                .sorted(Map.Entry.<Integer, Double>comparingByValue().reversed())
                .limit(numbersToSelect)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }
    
    /**
     * Calculates Tier 3 optimization score for a specific number.
     * Prioritizes frequently drawn numbers and recent appearance patterns.
     */
    private double calculateTier3Score(Integer number, 
                                       Map<Integer, Double> historicalFrequencies,
                                       List<int[]> recentDraws) {
        double score = 0.0;
        
        // Frequency component (70% weight)
        double frequency = historicalFrequencies.getOrDefault(number, 0.0);
        score += frequency * HOT_NUMBER_WEIGHT * 100;
        
        // Recent pattern component (30% weight)
        double recentScore = calculateRecentPatternScore(number, recentDraws);
        score += recentScore * PATTERN_MATCH_WEIGHT;
        
        return score;
    }
    
    /**
     * Analyzes how well a number fits recent winning patterns.
     */
    private double calculateRecentPatternScore(Integer number, List<int[]> recentDraws) {
        if (recentDraws == null || recentDraws.isEmpty()) {
            return 50.0; // Neutral score if no recent data
        }
        
        int appearances = 0;
        int totalDraws = Math.min(recentDraws.size(), 20); // Look at last 20 draws
        
        for (int i = 0; i < totalDraws; i++) {
            int[] draw = recentDraws.get(i);
            if (Arrays.stream(draw).anyMatch(n -> n == number)) {
                // Weight recent appearances more heavily
                double weight = 1.0 - (i * 0.05); // Recent draws weighted higher
                appearances += weight;
            }
        }
        
        return (appearances / totalDraws) * 100.0;
    }
    
    @Override
    public double evaluateTierPerformance(List<int[]> tickets,
                                          Map<Integer, Double> historicalFrequencies,
                                          List<int[]> recentDraws) {
        if (tickets == null || tickets.isEmpty()) {
            return 0.0;
        }
        
        double totalScore = 0.0;
        
        for (int[] ticket : tickets) {
            double ticketScore = evaluateTicketForTier3(ticket, historicalFrequencies, recentDraws);
            totalScore += ticketScore;
        }
        
        return totalScore / tickets.size();
    }
    
    /**
     * Evaluates how well a single ticket performs for Tier 3 optimization.
     */
    private double evaluateTicketForTier3(int[] ticket,
                                          Map<Integer, Double> historicalFrequencies,
                                          List<int[]> recentDraws) {
        double score = 0.0;
        
        // Evaluate frequency distribution
        double avgFrequency = Arrays.stream(ticket)
                .mapToDouble(number -> historicalFrequencies.getOrDefault(number, 0.0))
                .average()
                .orElse(0.0);
        
        score += avgFrequency * 60.0; // 60% weight on frequency
        
        // Evaluate pattern strength
        double patternScore = evaluatePatternStrength(ticket, recentDraws);
        score += patternScore * 40.0; // 40% weight on patterns
        
        return Math.min(score * 100, 100.0); // Cap at 100%
    }
    
    /**
     * Evaluates how well a ticket matches successful patterns.
     */
    private double evaluatePatternStrength(int[] ticket, List<int[]> recentDraws) {
        if (recentDraws == null || recentDraws.isEmpty()) {
            return 0.5; // Neutral if no pattern data
        }
        
        // Analyze spread and distribution patterns
        Arrays.sort(ticket);
        
        // Check for good number spread (Tier 3 benefits from coverage)
        int spread = ticket[ticket.length - 1] - ticket[0];
        double spreadScore = Math.min(spread / 30.0, 1.0); // Good spread across range
        
        // Check for balanced tens-digit distribution
        Set<Integer> tensDigits = Arrays.stream(ticket)
                .mapToObj(n -> (n - 1) / 10)
                .collect(Collectors.toSet());
        double balanceScore = tensDigits.size() / 5.0; // Prefer diverse tens digits
        
        return (spreadScore + balanceScore) / 2.0;
    }
    
    @Override
    public boolean shouldStopGeneration(double currentPerformance, int ticketsGenerated, int budget) {
        // Tier 3 stopping criteria - high performance threshold
        if (currentPerformance >= PERFORMANCE_THRESHOLD) {
            return true;
        }
        
        // Budget enforcement
        if (ticketsGenerated >= budget || ticketsGenerated >= MAX_TICKETS_PER_BUDGET) {
            return true;
        }
        
        // Early stopping if performance is very poor after significant generation
        if (ticketsGenerated > 20 && currentPerformance < 30.0) {
            return true;
        }
        
        return false;
    }
}