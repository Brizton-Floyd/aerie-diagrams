package com.floyd.lottoptions.legacy.desktop.tier;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Optimizer for Tier 4 prizes (4 matches - mid-tier prize).
 * Balances frequency patterns with number diversity for consistent mid-tier wins.
 */
public class Tier4Optimizer implements TierOptimizationStrategy {
    
    private static final int TIER_LEVEL = 4;
    private static final int REQUIRED_MATCHES = 4;
    private static final int PRIORITY = 6; // Medium priority tier
    
    // Tier 4 optimization parameters - more balanced approach
    private static final double HOT_NUMBER_WEIGHT = 0.5;
    private static final double WARM_NUMBER_WEIGHT = 0.3;
    private static final double PATTERN_DIVERSITY_WEIGHT = 0.2;
    private static final double PERFORMANCE_THRESHOLD = 65.0;
    private static final int MAX_TICKETS_PER_BUDGET = 75;
    
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
        
        // Step 1: Classify numbers into frequency categories
        List<Integer> hotNumbers = new ArrayList<>();
        List<Integer> warmNumbers = new ArrayList<>();
        List<Integer> coldNumbers = new ArrayList<>();
        
        classifyNumbersByFrequency(candidateNumbers, historicalFrequencies, 
                                   hotNumbers, warmNumbers, coldNumbers);
        
        // Step 2: Create balanced selection for Tier 4
        List<Integer> selectedNumbers = new ArrayList<>();
        
        // Select mix of hot and warm numbers for Tier 4 balance
        int hotCount = (int) (numbersToSelect * 0.5); // 50% hot
        int warmCount = (int) (numbersToSelect * 0.3); // 30% warm
        int remainingCount = numbersToSelect - hotCount - warmCount;
        
        selectedNumbers.addAll(selectTopNumbers(hotNumbers, hotCount, historicalFrequencies));
        selectedNumbers.addAll(selectTopNumbers(warmNumbers, warmCount, historicalFrequencies));
        
        // Fill remaining with best available (cold or additional warm)
        List<Integer> remaining = new ArrayList<>(warmNumbers);
        remaining.addAll(coldNumbers);
        remaining.removeAll(selectedNumbers);
        selectedNumbers.addAll(selectTopNumbers(remaining, remainingCount, historicalFrequencies));
        
        return selectedNumbers.stream()
                .limit(numbersToSelect)
                .collect(Collectors.toList());
    }
    
    /**
     * Classifies numbers into hot/warm/cold categories based on frequency.
     */
    private void classifyNumbersByFrequency(List<Integer> numbers,
                                            Map<Integer, Double> frequencies,
                                            List<Integer> hotNumbers,
                                            List<Integer> warmNumbers,
                                            List<Integer> coldNumbers) {
        
        double avgFrequency = frequencies.values().stream()
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
        
        double hotThreshold = avgFrequency * 1.2;
        double coldThreshold = avgFrequency * 0.8;
        
        for (Integer number : numbers) {
            double frequency = frequencies.getOrDefault(number, 0.0);
            
            if (frequency >= hotThreshold) {
                hotNumbers.add(number);
            } else if (frequency >= coldThreshold) {
                warmNumbers.add(number);
            } else {
                coldNumbers.add(number);
            }
        }
    }
    
    /**
     * Selects top numbers from a category based on frequency.
     */
    private List<Integer> selectTopNumbers(List<Integer> numbers, int count, 
                                           Map<Integer, Double> frequencies) {
        return numbers.stream()
                .sorted((a, b) -> frequencies.getOrDefault(b, 0.0)
                        .compareTo(frequencies.getOrDefault(a, 0.0)))
                .limit(count)
                .collect(Collectors.toList());
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
            double ticketScore = evaluateTicketForTier4(ticket, historicalFrequencies, recentDraws);
            totalScore += ticketScore;
        }
        
        return totalScore / tickets.size();
    }
    
    /**
     * Evaluates a single ticket for Tier 4 performance.
     */
    private double evaluateTicketForTier4(int[] ticket,
                                          Map<Integer, Double> historicalFrequencies,
                                          List<int[]> recentDraws) {
        double score = 0.0;
        
        // Frequency balance score (50% weight)
        double frequencyScore = calculateFrequencyBalance(ticket, historicalFrequencies);
        score += frequencyScore * 0.5;
        
        // Pattern diversity score (30% weight)
        double diversityScore = calculatePatternDiversity(ticket);
        score += diversityScore * 0.3;
        
        // Recent pattern alignment (20% weight)
        double patternScore = calculateRecentPatternAlignment(ticket, recentDraws);
        score += patternScore * 0.2;
        
        return Math.min(score * 100, 100.0);
    }
    
    /**
     * Calculates how well the ticket balances hot and warm numbers.
     */
    private double calculateFrequencyBalance(int[] ticket, Map<Integer, Double> frequencies) {
        double avgFrequency = frequencies.values().stream()
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
        
        int hotCount = 0;
        int warmCount = 0;
        
        for (int number : ticket) {
            double freq = frequencies.getOrDefault(number, 0.0);
            if (freq >= avgFrequency * 1.2) {
                hotCount++;
            } else if (freq >= avgFrequency * 0.8) {
                warmCount++;
            }
        }
        
        // Tier 4 benefits from balanced hot/warm distribution
        double hotRatio = (double) hotCount / ticket.length;
        double warmRatio = (double) warmCount / ticket.length;
        
        // Optimal: 50% hot, 30% warm for Tier 4
        double hotScore = 1.0 - Math.abs(hotRatio - 0.5);
        double warmScore = 1.0 - Math.abs(warmRatio - 0.3);
        
        return (hotScore + warmScore) / 2.0;
    }
    
    /**
     * Evaluates pattern diversity within the ticket.
     */
    private double calculatePatternDiversity(int[] ticket) {
        Arrays.sort(ticket);
        
        // Check tens-digit spread
        Set<Integer> tensDigits = Arrays.stream(ticket)
                .mapToObj(n -> (n - 1) / 10)
                .collect(Collectors.toSet());
        
        double tensSpread = (double) tensDigits.size() / Math.min(ticket.length, 5);
        
        // Check number spacing
        int totalSpread = ticket[ticket.length - 1] - ticket[0];
        double spacingScore = Math.min(totalSpread / 25.0, 1.0); // Good spread
        
        return (tensSpread + spacingScore) / 2.0;
    }
    
    /**
     * Evaluates alignment with recent winning patterns.
     */
    private double calculateRecentPatternAlignment(int[] ticket, List<int[]> recentDraws) {
        if (recentDraws == null || recentDraws.isEmpty()) {
            return 0.5;
        }
        
        // Check if ticket numbers appear in recent draws
        Set<Integer> ticketNumbers = Arrays.stream(ticket).boxed().collect(Collectors.toSet());
        int recentMatches = 0;
        
        for (int[] recentDraw : recentDraws.subList(0, Math.min(10, recentDraws.size()))) {
            Set<Integer> drawNumbers = Arrays.stream(recentDraw).boxed().collect(Collectors.toSet());
            int matches = (int) ticketNumbers.stream().filter(drawNumbers::contains).count();
            recentMatches += matches;
        }
        
        double maxPossibleMatches = Math.min(10, recentDraws.size()) * ticket.length;
        return maxPossibleMatches > 0 ? (double) recentMatches / maxPossibleMatches : 0.5;
    }
    
    @Override
    public boolean shouldStopGeneration(double currentPerformance, int ticketsGenerated, int budget) {
        // Tier 4 stopping criteria - moderate performance threshold
        if (currentPerformance >= PERFORMANCE_THRESHOLD) {
            return true;
        }
        
        // Budget enforcement with Tier 4 limits
        if (ticketsGenerated >= budget || ticketsGenerated >= MAX_TICKETS_PER_BUDGET) {
            return true;
        }
        
        // Allow more generation attempts for Tier 4 (more forgiving than Tier 3)
        if (ticketsGenerated > 30 && currentPerformance < 25.0) {
            return true;
        }
        
        return false;
    }
}