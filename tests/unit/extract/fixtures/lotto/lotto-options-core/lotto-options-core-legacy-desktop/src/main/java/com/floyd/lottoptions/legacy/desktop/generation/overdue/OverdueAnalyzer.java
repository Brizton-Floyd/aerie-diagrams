package com.floyd.lottoptions.legacy.desktop.generation.overdue;

import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;
import com.floyd.lottoptions.legacy.desktop.generation.criteria.GenerationStrategy;

import java.util.*;

/**
 * Analyzer responsible for identifying overdue numbers
 * that haven't appeared in recent lottery draws within configurable thresholds.
 */
public class OverdueAnalyzer {
    
    private final LotteryPersistenceClient persistenceClient;
    
    public OverdueAnalyzer(LotteryPersistenceClient persistenceClient) {
        this.persistenceClient = persistenceClient;
    }
    
    /**
     * Gets overdue threshold based on generation strategy.
     */
    private int getOverdueThreshold(GenerationStrategy strategy) {
        switch (strategy) {
            case CONSERVATIVE:
                return 20; // More draws before considering overdue
            case BALANCED:
                return 15; // Standard threshold
            case AGGRESSIVE:
                return 10; // Fewer draws before considering overdue
            default:
                return 15;
        }
    }
    
    /**
     * Checks if a number is currently overdue based on recent draws.
     */
    public boolean isNumberOverdue(int number, String lotteryConfigId, GenerationStrategy strategy) {
        try {
            int threshold = getOverdueThreshold(strategy);
            List<int[]> recentDraws = persistenceClient.getRecentDraws(lotteryConfigId, threshold);
            
            if (recentDraws == null) return false;
            
            for (int[] draw : recentDraws) {
                for (int drawNumber : draw) {
                    if (drawNumber == number) {
                        return false; // Number has appeared recently
                    }
                }
            }
            
            return true; // Number hasn't appeared in recent draws
            
        } catch (Exception e) {
            System.err.println("Error checking if number is overdue: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Gets count of draws since a number last appeared.
     */
    public int getDrawsSinceLastAppearance(int number, String lotteryConfigId) {
        try {
            List<int[]> recentDraws = persistenceClient.getRecentDraws(lotteryConfigId, 50);
            
            if (recentDraws == null) return 0;
            
            for (int i = 0; i < recentDraws.size(); i++) {
                int[] draw = recentDraws.get(i);
                for (int drawNumber : draw) {
                    if (drawNumber == number) {
                        return i; // Return how many draws ago it appeared
                    }
                }
            }
            
            return recentDraws.size(); // Hasn't appeared in available data
            
        } catch (Exception e) {
            System.err.println("Error getting draws since last appearance: " + e.getMessage());
            return 0;
        }
    }
}