package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;

import java.util.*;

/**
 * Service responsible for calculating and storing baseline performance metrics
 * for random lottery ticket selection across different prize tiers.
 * Provides the baseline against which improvement is measured.
 */
public class BaselinePerformanceService {
    
    private final LotteryPersistenceClient persistenceClient;
    private final Map<String, BaselinePerformance> baselineCache;
    
    public BaselinePerformanceService(LotteryPersistenceClient persistenceClient) {
        this.persistenceClient = persistenceClient;
        this.baselineCache = new HashMap<>();
    }
    
    /**
     * Gets baseline performance for random selection for a specific tier and lottery config.
     *
     * @param targetTier The prize tier (tier_3, tier_4, tier_5)
     * @param lotteryConfigId The lottery configuration identifier
     * @return BaselinePerformance metrics for random selection
     */
    public BaselinePerformance getBaselinePerformance(String targetTier, String lotteryConfigId) {
        String cacheKey = targetTier + "_" + lotteryConfigId;
        
        if (baselineCache.containsKey(cacheKey)) {
            return baselineCache.get(cacheKey);
        }
        
        BaselinePerformance baseline = calculateBaselinePerformance(targetTier, lotteryConfigId);
        baselineCache.put(cacheKey, baseline);
        
        return baseline;
    }
    
    /**
     * Calculates baseline performance for random ticket selection.
     */
    private BaselinePerformance calculateBaselinePerformance(String targetTier, String lotteryConfigId) {
        try {
            // Get historical data for analysis
            List<int[]> recentDraws = persistenceClient.getRecentDraws(lotteryConfigId, 100);
            
            if (recentDraws == null || recentDraws.isEmpty()) {
                return createDefaultBaseline(targetTier);
            }
            
            // Calculate mathematical odds for the tier
            double mathematicalOdds = calculateMathematicalOdds(targetTier);
            
            // Calculate historical performance of random selection
            double historicalPerformance = calculateHistoricalRandomPerformance(recentDraws, targetTier);
            
            // Use average of mathematical and historical for more accurate baseline
            double expectedWinRate = (mathematicalOdds + historicalPerformance) / 2.0;
            
            return new BaselinePerformance(expectedWinRate, mathematicalOdds, historicalPerformance, targetTier, lotteryConfigId);
            
        } catch (Exception e) {
            System.err.println("Error calculating baseline performance: " + e.getMessage());
            return createDefaultBaseline(targetTier);
        }
    }
    
    /**
     * Calculates mathematical odds for each tier in a typical 6/35 lottery.
     */
    private double calculateMathematicalOdds(String targetTier) {
        switch (targetTier.toLowerCase()) {
            case "tier_3":
                // Match 5 out of 6 numbers in 6/35 lottery
                // C(6,5) * C(29,1) / C(35,6) ≈ 1 in 9,724
                return 1.0 / 9724.0;
            case "tier_4":
                // Match 4 out of 6 numbers in 6/35 lottery  
                // C(6,4) * C(29,2) / C(35,6) ≈ 1 in 815
                return 1.0 / 815.0;
            case "tier_5":
                // Match 3 out of 6 numbers in 6/35 lottery
                // C(6,3) * C(29,3) / C(35,6) ≈ 1 in 61
                return 1.0 / 61.0;
            default:
                return 0.001; // Very low baseline for unknown tiers
        }
    }
    
    /**
     * Calculates historical performance of random selection by simulating
     * random tickets against recent draws.
     */
    private double calculateHistoricalRandomPerformance(List<int[]> recentDraws, String targetTier) {
        final int SIMULATION_SIZE = 1000;
        int wins = 0;
        
        Random random = new Random();
        
        for (int i = 0; i < SIMULATION_SIZE; i++) {
            // Generate random ticket
            int[] randomTicket = generateRandomTicket(random);
            
            // Check against recent draws
            for (int[] draw : recentDraws) {
                if (isWinningTicket(randomTicket, draw, targetTier)) {
                    wins++;
                    break; // Count only once per ticket
                }
            }
        }
        
        return (double) wins / SIMULATION_SIZE;
    }
    
    /**
     * Generates a random 6-number lottery ticket (1-35).
     */
    private int[] generateRandomTicket(Random random) {
        Set<Integer> numbers = new HashSet<>();
        while (numbers.size() < 6) {
            numbers.add(random.nextInt(35) + 1);
        }
        return numbers.stream().mapToInt(Integer::intValue).toArray();
    }
    
    /**
     * Checks if a ticket wins the target tier against a draw.
     */
    private boolean isWinningTicket(int[] ticket, int[] draw, String targetTier) {
        Set<Integer> ticketNumbers = new HashSet<>();
        Set<Integer> drawNumbers = new HashSet<>();
        
        for (int num : ticket) ticketNumbers.add(num);
        for (int num : draw) drawNumbers.add(num);
        
        ticketNumbers.retainAll(drawNumbers);
        int matches = ticketNumbers.size();
        
        switch (targetTier.toLowerCase()) {
            case "tier_3": return matches >= 5;
            case "tier_4": return matches >= 4;
            case "tier_5": return matches >= 3;
            default: return false;
        }
    }
    
    /**
     * Creates default baseline when historical data is unavailable.
     */
    private BaselinePerformance createDefaultBaseline(String targetTier) {
        double defaultRate = calculateMathematicalOdds(targetTier);
        return new BaselinePerformance(defaultRate, defaultRate, defaultRate, targetTier, "default");
    }
    
    /**
     * Clears the baseline cache (useful for testing or when data changes).
     */
    public void clearCache() {
        baselineCache.clear();
    }
}