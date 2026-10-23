package com.floyd.lottoptions.legacy.desktop.tier;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Tier 1 optimizer for jackpot targeting (perfect match: 6-of-6, 5-of-5).
 * Uses ultra-high precision strategy with maximum selectivity.
 * 
 * Strategy: Maximum precision, lowest volume
 * - Performance threshold: 90% (highest)
 * - Max tickets: 20 (ultra-selective)
 * - Number selection: 95% hot numbers, 5% diversity
 */
public class Tier1Optimizer implements TierOptimizationStrategy {
    
    private static final int TIER_LEVEL = 1;
    private static final double PERFORMANCE_THRESHOLD = 90.0;
    private static final int MAX_TICKETS_PER_GENERATION = 20;
    
    @Override
    public int getTierLevel() {
        return TIER_LEVEL;
    }
    
    @Override
    public int getRequiredMatches() {
        return 6; // Jackpot typically requires all matches (6 for most games)
    }
    
    @Override
    public int getPriority() {
        return 10; // Highest priority - jackpot
    }
    
    @Override
    public List<Integer> optimizeForTier(List<Integer> candidateNumbers, int numbersToSelect,
                                       Map<Integer, Double> numberFrequencies, List<int[]> recentDraws) {
        
        if (candidateNumbers.size() <= numbersToSelect) {
            return new ArrayList<>(candidateNumbers);
        }
        
        // Create weighted scores combining frequency and recency with jackpot bias
        Map<Integer, Double> numberScores = new HashMap<>();
        
        for (Integer number : candidateNumbers) {
            double score = calculateJackpotScore(number, numberFrequencies, recentDraws);
            numberScores.put(number, score);
        }
        
        // Select top numbers with 95% hot preference, 5% diversity
        return selectOptimalNumbers(numberScores, numbersToSelect, 0.95);
    }
    
    @Override
    public double evaluateTierPerformance(List<int[]> tickets, Map<Integer, Double> frequencies, List<int[]> recentDraws) {
        if (tickets.isEmpty()) {
            return 0.0;
        }
        
        double totalScore = 0.0;
        
        for (int[] ticket : tickets) {
            // Ultra-strict evaluation for jackpot potential
            double ticketScore = 0.0;
            
            for (int number : ticket) {
                // Heavy weight on hot numbers and recent appearances
                double frequency = frequencies.getOrDefault(number, 0.0);
                double recencyBonus = calculateRecencyBonus(number, recentDraws);
                ticketScore += (frequency * 0.8) + (recencyBonus * 0.2);
            }
            
            // Jackpot premium: reward tickets with exceptional hot number concentration
            double hotConcentration = calculateHotConcentration(ticket, frequencies);
            if (hotConcentration >= 0.8) {
                ticketScore *= 1.3; // 30% bonus for high hot concentration
            }
            
            totalScore += ticketScore;
        }
        
        return Math.min(100.0, (totalScore / tickets.size()) / 10.0);
    }
    
    @Override
    public boolean shouldStopGeneration(double performanceScore, int currentTickets, int maxBudget) {
        // Jackpot strategy: stop early if we achieve exceptional performance
        if (performanceScore >= PERFORMANCE_THRESHOLD) {
            return true;
        }
        
        // Very conservative ticket limit for jackpot targeting
        if (currentTickets >= MAX_TICKETS_PER_GENERATION) {
            return true;
        }
        
        // Stop if we've used reasonable jackpot budget (higher cost per ticket acceptable)
        double estimatedCostPerTicket = 5.0; // Assuming higher cost for jackpot plays
        if (currentTickets * estimatedCostPerTicket >= maxBudget) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Calculates jackpot-specific scoring for numbers.
     * Heavily weights hot numbers and recent appearances.
     */
    private double calculateJackpotScore(Integer number, Map<Integer, Double> frequencies, List<int[]> recentDraws) {
        double frequency = frequencies.getOrDefault(number, 0.0);
        double recencyBonus = calculateRecencyBonus(number, recentDraws);
        
        // Jackpot formula: 80% frequency, 20% recency
        double baseScore = (frequency * 0.8) + (recencyBonus * 0.2);
        
        // Jackpot premium for consistently hot numbers
        if (frequency >= 15.0) { // Assuming frequency is count-based
            baseScore *= 1.2;
        }
        
        return baseScore;
    }
    
    /**
     * Calculates recency bonus based on recent draw appearances.
     */
    private double calculateRecencyBonus(Integer number, List<int[]> recentDraws) {
        if (recentDraws.isEmpty()) {
            return 0.0;
        }
        
        double bonus = 0.0;
        double decayFactor = 1.0;
        
        // Check most recent draws (reverse order for recency weight)
        for (int i = recentDraws.size() - 1; i >= 0 && i >= recentDraws.size() - 10; i--) {
            int[] draw = recentDraws.get(i);
            if (Arrays.stream(draw).anyMatch(n -> n == number)) {
                bonus += decayFactor;
            }
            decayFactor *= 0.8; // Decay for older draws
        }
        
        return bonus;
    }
    
    /**
     * Calculates hot number concentration in a ticket.
     */
    private double calculateHotConcentration(int[] ticket, Map<Integer, Double> frequencies) {
        double totalFrequency = frequencies.values().stream().mapToDouble(Double::doubleValue).sum();
        if (totalFrequency == 0) {
            return 0.0;
        }
        
        double ticketHotness = 0.0;
        for (int number : ticket) {
            ticketHotness += frequencies.getOrDefault(number, 0.0);
        }
        
        double averageFrequency = totalFrequency / frequencies.size();
        return Math.min(1.0, ticketHotness / (ticket.length * averageFrequency));
    }
    
    /**
     * Selects optimal numbers using weighted selection with bias control.
     */
    private List<Integer> selectOptimalNumbers(Map<Integer, Double> numberScores, int count, double hotBias) {
        // Sort by score descending
        List<Map.Entry<Integer, Double>> sortedNumbers = numberScores.entrySet().stream()
            .sorted((e1, e2) -> Double.compare(e2.getValue(), e1.getValue()))
            .collect(Collectors.toList());
        
        List<Integer> selected = new ArrayList<>();
        int hotCount = (int) (count * hotBias);
        int diversityCount = count - hotCount;
        
        // Select top hot numbers
        for (int i = 0; i < hotCount && i < sortedNumbers.size(); i++) {
            selected.add(sortedNumbers.get(i).getKey());
        }
        
        // Add some diversity from remaining numbers
        for (int i = hotCount; i < Math.min(hotCount + diversityCount, sortedNumbers.size()); i++) {
            selected.add(sortedNumbers.get(i).getKey());
        }
        
        return selected;
    }
    
    @Override
    public String toString() {
        return "Tier1Optimizer{level=" + TIER_LEVEL + ", threshold=" + PERFORMANCE_THRESHOLD + 
               "%, maxTickets=" + MAX_TICKETS_PER_GENERATION + ", strategy=JACKPOT_PRECISION}";
    }
}