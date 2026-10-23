package com.floyd.lottoptions.legacy.desktop.tier;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Tier 2 optimizer for near-jackpot targeting (close to perfect match).
 * Uses high precision strategy with selective approach.
 * 
 * Strategy: High precision, low-medium volume
 * - Performance threshold: 85% (very high)
 * - Max tickets: 30 (selective)
 * - Number selection: 85% hot numbers, 15% pattern diversity
 */
public class Tier2Optimizer implements TierOptimizationStrategy {
    
    private static final int TIER_LEVEL = 2;
    private static final double PERFORMANCE_THRESHOLD = 85.0;
    private static final int MAX_TICKETS_PER_GENERATION = 30;
    
    @Override
    public int getTierLevel() {
        return TIER_LEVEL;
    }
    
    @Override
    public int getRequiredMatches() {
        return 5; // Near-jackpot typically requires 5 matches (for 6-number games)
    }
    
    @Override
    public int getPriority() {
        return 9; // Very high priority - near-jackpot
    }
    
    @Override
    public List<Integer> optimizeForTier(List<Integer> candidateNumbers, int numbersToSelect,
                                       Map<Integer, Double> numberFrequencies, List<int[]> recentDraws) {
        
        if (candidateNumbers.size() <= numbersToSelect) {
            return new ArrayList<>(candidateNumbers);
        }
        
        // Create comprehensive scores for near-jackpot optimization
        Map<Integer, Double> numberScores = new HashMap<>();
        
        for (Integer number : candidateNumbers) {
            double score = calculateNearJackpotScore(number, numberFrequencies, recentDraws);
            numberScores.put(number, score);
        }
        
        // Select numbers with 85% hot preference, 15% pattern diversity
        return selectBalancedNumbers(numberScores, numbersToSelect, 0.85);
    }
    
    @Override
    public double evaluateTierPerformance(List<int[]> tickets, Map<Integer, Double> frequencies, List<int[]> recentDraws) {
        if (tickets.isEmpty()) {
            return 0.0;
        }
        
        double totalScore = 0.0;
        
        for (int[] ticket : tickets) {
            double ticketScore = 0.0;
            
            // Evaluate each number's contribution
            for (int number : ticket) {
                double frequency = frequencies.getOrDefault(number, 0.0);
                double recencyBonus = calculateRecencyBonus(number, recentDraws);
                double patternBonus = calculatePatternBonus(number, ticket, frequencies);
                
                ticketScore += (frequency * 0.6) + (recencyBonus * 0.25) + (patternBonus * 0.15);
            }
            
            // Near-jackpot bonus: reward balanced hot/pattern combinations
            double balance = calculateHotPatternBalance(ticket, frequencies);
            if (balance >= 0.7) {
                ticketScore *= 1.15; // 15% bonus for good balance
            }
            
            totalScore += ticketScore;
        }
        
        return Math.min(100.0, (totalScore / tickets.size()) / 8.0);
    }
    
    @Override
    public boolean shouldStopGeneration(double performanceScore, int currentTickets, int maxBudget) {
        // Near-jackpot strategy: balance performance with reasonable volume
        if (performanceScore >= PERFORMANCE_THRESHOLD) {
            return true;
        }
        
        // Moderate ticket limit for near-jackpot targeting
        if (currentTickets >= MAX_TICKETS_PER_GENERATION) {
            return true;
        }
        
        // Budget consideration for near-jackpot plays
        double estimatedCostPerTicket = 3.0; // Medium cost assumption
        if (currentTickets * estimatedCostPerTicket >= maxBudget) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Calculates near-jackpot specific scoring for numbers.
     * Balances hot numbers with pattern considerations.
     */
    private double calculateNearJackpotScore(Integer number, Map<Integer, Double> frequencies, List<int[]> recentDraws) {
        double frequency = frequencies.getOrDefault(number, 0.0);
        double recencyBonus = calculateRecencyBonus(number, recentDraws);
        
        // Near-jackpot formula: 70% frequency, 20% recency, 10% pattern diversity
        double baseScore = (frequency * 0.7) + (recencyBonus * 0.2);
        
        // Add pattern diversity bonus for numbers in different ranges
        double diversityBonus = calculateNumberRangeDiversity(number);
        baseScore += diversityBonus * 0.1;
        
        // Boost for moderately hot numbers (not just the hottest)
        if (frequency >= 8.0 && frequency <= 20.0) {
            baseScore *= 1.1;
        }
        
        return baseScore;
    }
    
    /**
     * Calculates recency bonus with near-jackpot weighting.
     */
    private double calculateRecencyBonus(Integer number, List<int[]> recentDraws) {
        if (recentDraws.isEmpty()) {
            return 0.0;
        }
        
        double bonus = 0.0;
        double decayFactor = 1.0;
        
        // Check recent draws with moderate decay
        for (int i = recentDraws.size() - 1; i >= 0 && i >= recentDraws.size() - 12; i--) {
            int[] draw = recentDraws.get(i);
            if (Arrays.stream(draw).anyMatch(n -> n == number)) {
                bonus += decayFactor;
            }
            decayFactor *= 0.85; // Slower decay than jackpot tier
        }
        
        return bonus;
    }
    
    /**
     * Calculates pattern bonus based on number's relationship to others in ticket.
     */
    private double calculatePatternBonus(Integer number, int[] ticket, Map<Integer, Double> frequencies) {
        // Simple pattern bonus based on number spacing and frequency distribution
        double bonus = 0.0;
        
        // Check for good spacing (not too clustered)
        int[] sortedTicket = Arrays.stream(ticket).sorted().toArray();
        int position = Arrays.binarySearch(sortedTicket, number);
        
        if (position >= 0 && position < sortedTicket.length - 1) {
            int nextGap = sortedTicket[position + 1] - number;
            if (nextGap >= 3 && nextGap <= 12) { // Good spacing
                bonus += 0.5;
            }
        }
        
        return bonus;
    }
    
    /**
     * Calculates balance between hot numbers and pattern diversity.
     */
    private double calculateHotPatternBalance(int[] ticket, Map<Integer, Double> frequencies) {
        double totalFrequency = frequencies.values().stream().mapToDouble(Double::doubleValue).sum();
        if (totalFrequency == 0) {
            return 0.0;
        }
        
        double averageFrequency = totalFrequency / frequencies.size();
        int hotNumbers = 0;
        
        for (int number : ticket) {
            if (frequencies.getOrDefault(number, 0.0) > averageFrequency) {
                hotNumbers++;
            }
        }
        
        double hotRatio = (double) hotNumbers / ticket.length;
        // Ideal ratio is around 70-80% hot numbers
        return 1.0 - Math.abs(hotRatio - 0.75);
    }
    
    /**
     * Calculates diversity bonus based on number range distribution.
     */
    private double calculateNumberRangeDiversity(Integer number) {
        // Bonus for numbers that provide range diversity
        int tensDigit = (number - 1) / 10;
        
        // Slight bonus for middle ranges (balanced distribution)
        switch (tensDigit) {
            case 1: case 2: case 3: // Middle ranges
                return 0.2;
            case 0: case 4: case 5: // Edge ranges
                return 0.1;
            default:
                return 0.0;
        }
    }
    
    /**
     * Selects balanced numbers using weighted selection with controlled randomness.
     */
    private List<Integer> selectBalancedNumbers(Map<Integer, Double> numberScores, int count, double hotBias) {
        List<Map.Entry<Integer, Double>> sortedNumbers = numberScores.entrySet().stream()
            .sorted((e1, e2) -> Double.compare(e2.getValue(), e1.getValue()))
            .collect(Collectors.toList());
        
        List<Integer> selected = new ArrayList<>();
        int hotCount = (int) (count * hotBias);
        int diversityCount = count - hotCount;
        
        // Select top performing numbers
        for (int i = 0; i < hotCount && i < sortedNumbers.size(); i++) {
            selected.add(sortedNumbers.get(i).getKey());
        }
        
        // Add balanced diversity from remaining pool
        Random random = new Random();
        Set<Integer> usedIndices = new HashSet<>();
        for (int i = 0; i < hotCount; i++) {
            usedIndices.add(i);
        }
        
        for (int i = 0; i < diversityCount; i++) {
            int attempts = 0;
            while (attempts < 20) {
                int index = hotCount + random.nextInt(Math.max(1, sortedNumbers.size() - hotCount));
                if (!usedIndices.contains(index) && index < sortedNumbers.size()) {
                    selected.add(sortedNumbers.get(index).getKey());
                    usedIndices.add(index);
                    break;
                }
                attempts++;
            }
        }
        
        return selected;
    }
    
    @Override
    public String toString() {
        return "Tier2Optimizer{level=" + TIER_LEVEL + ", threshold=" + PERFORMANCE_THRESHOLD + 
               "%, maxTickets=" + MAX_TICKETS_PER_GENERATION + ", strategy=NEAR_JACKPOT_BALANCED}";
    }
}