package com.floyd.lottoptions.legacy.desktop.tier;

import com.floyd.lottoptions.legacy.desktop.generation.criteria.StoppingCriteria;
import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;
import com.floyd.lottoptions.legacy.desktop.quality.QualityMetrics;

import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Manager for tier-specific optimization that integrates with existing
 * generation infrastructure without breaking current functionality.
 */
public class TierOptimizationManager {
    
    private final Map<Integer, TierOptimizationStrategy> tierStrategies;
    private final LotteryPersistenceClient persistenceClient;
    
    public TierOptimizationManager(LotteryPersistenceClient persistenceClient) {
        this.persistenceClient = persistenceClient;
        this.tierStrategies = initializeTierStrategies();
    }
    
    /**
     * Initializes all available tier optimization strategies.
     */
    private Map<Integer, TierOptimizationStrategy> initializeTierStrategies() {
        Map<Integer, TierOptimizationStrategy> strategies = new HashMap<>();
        strategies.put(1, new Tier1Optimizer()); // Jackpot (perfect match)
        strategies.put(2, new Tier2Optimizer()); // Near-jackpot
        strategies.put(3, new Tier3Optimizer()); // High-tier secondary
        strategies.put(4, new Tier4Optimizer()); // Mid-tier
        strategies.put(5, new Tier5Optimizer()); // Low-tier frequent wins
        return strategies;
    }
    
    /**
     * Gets the appropriate tier strategy for a target tier string.
     * Supports both legacy tier formats ("tier_3") and new match-based formats ("5-of-6").
     */
    public Optional<TierOptimizationStrategy> getTierStrategy(String targetTier) {
        if (targetTier == null) {
            return Optional.empty();
        }
        
        // First try parsing as match-based format (e.g., "5-of-6", "4-of-5")
        Integer tierLevel = parseMatchBasedTarget(targetTier);
        
        if (tierLevel != null) {
            System.out.println("Parsed match-based target '" + targetTier + "' to tier level " + tierLevel);
        } else {
            // If match-based parsing fails, fall back to legacy tier format
            tierLevel = parseLegacyTierLevel(targetTier);
            if (tierLevel != null) {
                System.out.println("Parsed legacy target '" + targetTier + "' to tier level " + tierLevel);
            }
        }
        
        return tierLevel != null ? Optional.ofNullable(tierStrategies.get(tierLevel)) : Optional.empty();
    }
    
    /**
     * Parses match-based target formats like "6-of-6", "5-of-6", "4-of-5", "3-of-6".
     * Maps match difficulty to appropriate tier optimization strategy with jackpot support.
     * 
     * Logic:
     * - Perfect match (6-of-6, 5-of-5): Use Tier 1 (jackpot precision)
     * - High-value near-perfect (5-of-6 for 6-number games): Use Tier 2 (near-jackpot)
     * - Secondary prizes (4-of-5, 4-of-6): Use Tier 3 (high precision)  
     * - Mid-tier prizes (3-of-5, 3-of-6): Use Tier 4 (balanced)
     * - Low-tier frequent wins: Use Tier 5 (volume)
     * - Very low probability: No optimization (too low)
     */
    private Integer parseMatchBasedTarget(String targetTier) {
        String target = targetTier.toLowerCase().trim();
        
        // Match pattern like "5-of-6", "4-of-5", etc.
        if (target.matches("\\d+-of-\\d+")) {
            String[] parts = target.split("-of-");
            try {
                int matches = Integer.parseInt(parts[0]);
                int total = Integer.parseInt(parts[1]);
                int difference = total - matches;
                
                System.out.println("Parsing " + targetTier + ": " + matches + " matches out of " + total + 
                                 " (difference: " + difference + ")");
                
                // Map based on match difficulty and game type
                if (difference == 0) {
                    // Perfect match - JACKPOT
                    return 1; // Tier1 - Ultimate jackpot precision
                    
                } else if (difference == 1) {
                    // One less than perfect
                    if (total >= 6) {
                        // High-value games (6+): Near-jackpot strategy
                        return 2; // Tier2 - Near-jackpot balanced
                    } else {
                        // Smaller games (5): High secondary prize
                        return 3; // Tier3 - High precision
                    }
                    
                } else if (difference == 2) {
                    // Two less than perfect - good secondary prizes
                    return 4; // Tier4 - Balanced approach
                    
                } else if (difference == 3) {
                    // Three less - frequent smaller wins
                    return 5; // Tier5 - Volume strategy
                    
                } else {
                    // 4+ less than perfect - probability too low for optimization
                    System.out.println("Target " + targetTier + " has too low probability for optimization");
                    return null;
                }
                
            } catch (NumberFormatException e) {
                System.err.println("Invalid match-based target format: " + targetTier);
            }
        }
        
        return null; // Not a valid match-based format
    }
    
    /**
     * Parses legacy tier level from existing tier string formats.
     * Supports: "jackpot", "tier_1", "tier_2", "tier_3", "tier_4", "tier_5", "1", "2", "3", "4", "5"
     */
    private Integer parseLegacyTierLevel(String targetTier) {
        String tier = targetTier.toLowerCase().trim();
        
        // Handle common jackpot terms
        if (tier.contains("jackpot") || tier.contains("grand")) {
            return 1; // Jackpot = Tier 1
        } else if (tier.contains("tier_1") || tier.equals("1")) {
            return 1;
        } else if (tier.contains("tier_2") || tier.equals("2")) {
            return 2;
        } else if (tier.contains("tier_3") || tier.equals("3")) {
            return 3;
        } else if (tier.contains("tier_4") || tier.equals("4")) {
            return 4;
        } else if (tier.contains("tier_5") || tier.equals("5")) {
            return 5;
        }
        
        return null; // Not a supported tier for optimization
    }
    
    /**
     * Creates tier-specific stopping criteria that layers on top of existing criteria.
     * Preserves all current stopping behavior while adding tier optimization.
     */
    public TierSpecificStoppingCriteria createTierStoppingCriteria(StoppingCriteria baseCriteria, 
                                                                    String targetTier) {
        Optional<TierOptimizationStrategy> strategy = getTierStrategy(targetTier);
        return new TierSpecificStoppingCriteria(baseCriteria, strategy.orElse(null));
    }
    
    /**
     * Optimizes number selection for a specific tier using existing candidate numbers.
     * This method can be called from existing generation logic without breaking flow.
     */
    public CompletableFuture<List<Integer>> optimizeNumbersForTier(String targetTier,
                                                                   List<Integer> candidateNumbers,
                                                                   int numbersToSelect,
                                                                   String lotteryConfigId) {
        
        Optional<TierOptimizationStrategy> strategyOpt = getTierStrategy(targetTier);
        
        if (!strategyOpt.isPresent()) {
            // No tier strategy available - return candidates as-is (preserve existing behavior)
            return CompletableFuture.completedFuture(
                candidateNumbers.stream().limit(numbersToSelect).collect(ArrayList::new, ArrayList::add, ArrayList::addAll)
            );
        }
        
        TierOptimizationStrategy strategy = strategyOpt.get();
        
        // Get historical data for optimization
        CompletableFuture<Map<Integer, Double>> frequenciesFuture = 
                CompletableFuture.supplyAsync(() -> persistenceClient.getNumberFrequencies(lotteryConfigId));
        
        CompletableFuture<List<int[]>> recentDrawsFuture = 
                CompletableFuture.supplyAsync(() -> persistenceClient.getRecentDraws(lotteryConfigId, 20));
        
        return CompletableFuture.allOf(frequenciesFuture, recentDrawsFuture)
                .thenApply(v -> {
                    Map<Integer, Double> frequencies = frequenciesFuture.join();
                    List<int[]> recentDraws = recentDrawsFuture.join();
                    
                    return strategy.optimizeForTier(candidateNumbers, numbersToSelect, 
                                                    frequencies, recentDraws);
                })
                .exceptionally(throwable -> {
                    System.err.println("Error in tier optimization for " + targetTier + ": " + throwable.getMessage());
                    // Fallback to original candidates if tier optimization fails
                    return candidateNumbers.stream().limit(numbersToSelect)
                            .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                });
    }
    
    /**
     * Evaluates tier-specific performance for quality metrics enhancement.
     * Can be integrated into existing quality evaluation without breaking current metrics.
     */
    public CompletableFuture<Double> evaluateTierPerformance(String targetTier,
                                                             List<int[]> tickets,
                                                             String lotteryConfigId) {
        
        Optional<TierOptimizationStrategy> strategyOpt = getTierStrategy(targetTier);
        
        if (!strategyOpt.isPresent()) {
            return CompletableFuture.completedFuture(0.0); // No tier-specific evaluation
        }
        
        TierOptimizationStrategy strategy = strategyOpt.get();
        
        // Get data for evaluation
        CompletableFuture<Map<Integer, Double>> frequenciesFuture = 
                CompletableFuture.supplyAsync(() -> persistenceClient.getNumberFrequencies(lotteryConfigId));
        
        CompletableFuture<List<int[]>> recentDrawsFuture = 
                CompletableFuture.supplyAsync(() -> persistenceClient.getRecentDraws(lotteryConfigId, 15));
        
        return CompletableFuture.allOf(frequenciesFuture, recentDrawsFuture)
                .thenApply(v -> {
                    Map<Integer, Double> frequencies = frequenciesFuture.join();
                    List<int[]> recentDraws = recentDrawsFuture.join();
                    
                    return strategy.evaluateTierPerformance(tickets, frequencies, recentDraws);
                })
                .exceptionally(throwable -> {
                    System.err.println("Error evaluating tier performance for " + targetTier + ": " + throwable.getMessage());
                    return 0.0;
                });
    }
    
    /**
     * Gets all available tier strategies for information purposes.
     */
    public Map<Integer, TierOptimizationStrategy> getAllTierStrategies() {
        return new HashMap<>(tierStrategies);
    }
}