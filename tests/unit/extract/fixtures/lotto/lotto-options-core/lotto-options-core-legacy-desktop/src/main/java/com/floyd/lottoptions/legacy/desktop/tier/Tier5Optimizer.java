package com.floyd.lottoptions.legacy.desktop.tier;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Optimizer for Tier 5 prizes (3 matches - frequent small wins).
 * Focuses on consistent, achievable wins with broader number coverage.
 */
public class Tier5Optimizer implements TierOptimizationStrategy {
    
    private static final int TIER_LEVEL = 5;
    private static final int REQUIRED_MATCHES = 3;
    private static final int PRIORITY = 4; // Lower priority, but high frequency
    
    // Tier 5 optimization parameters - broader, more inclusive approach
    private static final double WARM_NUMBER_WEIGHT = 0.6;
    private static final double COVERAGE_WEIGHT = 0.4;
    private static final double PERFORMANCE_THRESHOLD = 55.0; // More achievable threshold
    private static final int MAX_TICKETS_PER_BUDGET = 100; // Allow more tickets for frequent wins
    
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
        
        // Step 1: Score numbers for Tier 5 optimization (broader approach)
        Map<Integer, Double> numberScores = new HashMap<>();
        
        for (Integer number : candidateNumbers) {
            double score = calculateTier5Score(number, historicalFrequencies, recentDraws);
            numberScores.put(number, score);
        }
        
        // Step 2: Select numbers with balanced scoring for consistent Tier 5 wins
        return numberScores.entrySet().stream()
                .sorted(Map.Entry.<Integer, Double>comparingByValue().reversed())
                .limit(numbersToSelect)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }
    
    /**
     * Calculates Tier 5 optimization score - emphasizes consistent, moderate performers.
     */
    private double calculateTier5Score(Integer number, 
                                       Map<Integer, Double> historicalFrequencies,
                                       List<int[]> recentDraws) {
        double score = 0.0;
        
        // Warm number preference (60% weight) - not too hot, not too cold
        double frequency = historicalFrequencies.getOrDefault(number, 0.0);
        double warmScore = calculateWarmNumberScore(frequency, historicalFrequencies);
        score += warmScore * WARM_NUMBER_WEIGHT * 100;
        
        // Coverage diversity (40% weight) - helps with 3-match combinations
        double coverageScore = calculateCoverageScore(number, recentDraws);
        score += coverageScore * COVERAGE_WEIGHT * 100;
        
        return score;
    }
    
    /**
     * Calculates warm number score - prefers moderate frequency numbers.
     */
    private double calculateWarmNumberScore(double frequency, Map<Integer, Double> allFrequencies) {
        double avgFrequency = allFrequencies.values().stream()
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
        
        // Tier 5 prefers numbers near average frequency (warm numbers)
        double deviationFromAverage = Math.abs(frequency - avgFrequency);
        double maxDeviation = avgFrequency; // Normalize by average
        
        if (maxDeviation == 0.0) {
            return 0.5; // Neutral if no frequency data
        }
        
        // Score inversely related to deviation from average
        return Math.max(0.0, 1.0 - (deviationFromAverage / maxDeviation));
    }
    
    /**
     * Calculates coverage score for broader number selection.
     */
    private double calculateCoverageScore(Integer number, List<int[]> recentDraws) {
        if (recentDraws == null || recentDraws.isEmpty()) {
            return 0.5;
        }
        
        // For Tier 5, prefer numbers that appear moderately in recent draws
        int appearances = 0;
        int totalDraws = Math.min(recentDraws.size(), 15);
        
        for (int i = 0; i < totalDraws; i++) {
            int[] draw = recentDraws.get(i);
            if (Arrays.stream(draw).anyMatch(n -> n == number)) {
                appearances++;
            }
        }
        
        double appearanceRate = (double) appearances / totalDraws;
        
        // Tier 5 prefers moderate appearance rates (not too frequent, not absent)
        if (appearanceRate >= 0.2 && appearanceRate <= 0.4) {
            return 1.0; // Ideal range for Tier 5
        } else if (appearanceRate >= 0.1 && appearanceRate <= 0.6) {
            return 0.7; // Good range
        } else {
            return 0.3; // Outside preferred range
        }
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
            double ticketScore = evaluateTicketForTier5(ticket, historicalFrequencies, recentDraws);
            totalScore += ticketScore;
        }
        
        return totalScore / tickets.size();
    }
    
    /**
     * Evaluates how well a single ticket performs for Tier 5 optimization.
     */
    private double evaluateTicketForTier5(int[] ticket,
                                          Map<Integer, Double> historicalFrequencies,
                                          List<int[]> recentDraws) {
        double score = 0.0;
        
        // Warm number distribution (40% weight)
        double warmScore = evaluateWarmNumberDistribution(ticket, historicalFrequencies);
        score += warmScore * 0.4;
        
        // Coverage breadth (35% weight) - important for 3-match wins
        double coverageScore = evaluateCoverageBreadth(ticket);
        score += coverageScore * 0.35;
        
        // Consistency with recent patterns (25% weight)
        double consistencyScore = evaluatePatternConsistency(ticket, recentDraws);
        score += consistencyScore * 0.25;
        
        return Math.min(score * 100, 100.0);
    }
    
    /**
     * Evaluates warm number distribution in the ticket.
     */
    private double evaluateWarmNumberDistribution(int[] ticket, Map<Integer, Double> frequencies) {
        double avgFrequency = frequencies.values().stream()
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
        
        int warmNumbers = 0;
        for (int number : ticket) {
            double freq = frequencies.getOrDefault(number, 0.0);
            if (freq >= avgFrequency * 0.8 && freq <= avgFrequency * 1.2) {
                warmNumbers++;
            }
        }
        
        double warmRatio = (double) warmNumbers / ticket.length;
        // Tier 5 benefits from 60-80% warm numbers
        if (warmRatio >= 0.6 && warmRatio <= 0.8) {
            return 1.0;
        } else if (warmRatio >= 0.4) {
            return 0.7;
        } else {
            return 0.3;
        }
    }
    
    /**
     * Evaluates coverage breadth for 3-match potential.
     */
    private double evaluateCoverageBreadth(int[] ticket) {
        Arrays.sort(ticket);
        
        // Good spread across number range
        int spread = ticket[ticket.length - 1] - ticket[0];
        double spreadScore = Math.min(spread / 20.0, 1.0); // Moderate spread preferred
        
        // Diverse tens-digit representation
        Set<Integer> tensDigits = Arrays.stream(ticket)
                .mapToObj(n -> (n - 1) / 10)
                .collect(Collectors.toSet());
        double tensScore = (double) tensDigits.size() / 4.0; // 4+ different tens groups ideal
        
        return (spreadScore + tensScore) / 2.0;
    }
    
    /**
     * Evaluates consistency with recent successful patterns.
     */
    private double evaluatePatternConsistency(int[] ticket, List<int[]> recentDraws) {
        if (recentDraws == null || recentDraws.isEmpty()) {
            return 0.5;
        }
        
        Set<Integer> ticketNumbers = Arrays.stream(ticket).boxed().collect(Collectors.toSet());
        int totalMatches = 0;
        int drawsChecked = Math.min(8, recentDraws.size());
        
        for (int i = 0; i < drawsChecked; i++) {
            Set<Integer> drawNumbers = Arrays.stream(recentDraws.get(i))
                    .boxed().collect(Collectors.toSet());
            int matches = (int) ticketNumbers.stream().filter(drawNumbers::contains).count();
            totalMatches += matches;
        }
        
        // For Tier 5, moderate consistency is good (not too similar to recent draws)
        double avgMatches = (double) totalMatches / (drawsChecked * ticket.length);
        
        if (avgMatches >= 0.15 && avgMatches <= 0.35) {
            return 1.0; // Ideal consistency range
        } else if (avgMatches >= 0.1 && avgMatches <= 0.5) {
            return 0.7; // Acceptable range
        } else {
            return 0.4; // Outside ideal range
        }
    }
    
    @Override
    public boolean shouldStopGeneration(double currentPerformance, int ticketsGenerated, int budget) {
        // Tier 5 stopping criteria - more lenient thresholds for frequent wins
        if (currentPerformance >= PERFORMANCE_THRESHOLD) {
            return true;
        }
        
        // Budget enforcement with higher ticket allowance
        if (ticketsGenerated >= budget || ticketsGenerated >= MAX_TICKETS_PER_BUDGET) {
            return true;
        }
        
        // More generous stopping criteria for Tier 5 (frequent small wins strategy)
        if (ticketsGenerated > 40 && currentPerformance < 20.0) {
            return true;
        }
        
        return false;
    }
}