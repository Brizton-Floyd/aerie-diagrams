package com.floyd.lottoptions.legacy.desktop.generation.advanced;

import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeDroughtAnalysis;
import com.floyd.lottoptions.legacy.desktop.generation.performance.PatternPerformanceAnalysis;
import com.floyd.persistence.model.LotteryGame;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Advanced number selection algorithms that intelligently combine
 * Phase 1 drought analysis with Phase 2 pattern performance data
 * to generate optimized lottery number selections.
 */
public class IntelligentNumberSelector {
    
    private final LotteryGame lotteryGame;
    private final PrizeDroughtAnalysis droughtAnalysis;
    private final PatternPerformanceAnalysis patternAnalysis;
    private final Random random;
    
    // Selection weights and parameters
    private static final double DROUGHT_WEIGHT = 0.4;
    private static final double PATTERN_WEIGHT = 0.35;
    private static final double FREQUENCY_WEIGHT = 0.15;
    private static final double RANDOMNESS_WEIGHT = 0.1;
    
    public IntelligentNumberSelector(LotteryGame lotteryGame, 
                                   PrizeDroughtAnalysis droughtAnalysis,
                                   PatternPerformanceAnalysis patternAnalysis) {
        this.lotteryGame = lotteryGame;
        this.droughtAnalysis = droughtAnalysis;
        this.patternAnalysis = patternAnalysis;
        this.random = new Random(System.nanoTime());
    }
    
    /**
     * Generates a single optimized number combination using advanced selection algorithms.
     */
    public int[] generateOptimizedCombination() {
        int minNumber = lotteryGame.getMinNumber();
        int maxNumber = lotteryGame.getMaxNumber();
        int drawPositionCount = lotteryGame.getDrawPositionCount();
        
        // Calculate selection weights for each number
        Map<Integer, Double> numberWeights = calculateNumberWeights(minNumber, maxNumber);
        
        // Use weighted selection to choose numbers
        Set<Integer> selectedNumbers = new TreeSet<>();
        
        while (selectedNumbers.size() < drawPositionCount) {
            int selectedNumber = selectWeightedNumber(numberWeights, selectedNumbers);
            selectedNumbers.add(selectedNumber);
            
            // Adjust remaining weights to promote number diversity
            adjustWeightsForDiversity(numberWeights, selectedNumber);
        }
        
        return selectedNumbers.stream().mapToInt(Integer::intValue).toArray();
    }
    
    /**
     * Generates multiple optimized combinations with controlled diversity.
     */
    public List<int[]> generateOptimizedCombinations(int count) {
        List<int[]> combinations = new ArrayList<>();
        Set<String> generatedCombinationHashes = new HashSet<>();
        
        int maxAttempts = count * 3; // Prevent infinite loops
        int attempts = 0;
        
        while (combinations.size() < count && attempts < maxAttempts) {
            attempts++;
            
            int[] combination = generateOptimizedCombination();
            String hash = Arrays.toString(combination);
            
            if (!generatedCombinationHashes.contains(hash)) {
                combinations.add(combination);
                generatedCombinationHashes.add(hash);
            }
        }
        
        return combinations;
    }
    
    /**
     * Calculates intelligent weights for each number based on multiple factors.
     */
    private Map<Integer, Double> calculateNumberWeights(int minNumber, int maxNumber) {
        Map<Integer, Double> weights = new HashMap<>();
        
        for (int number = minNumber; number <= maxNumber; number++) {
            double weight = calculateIndividualNumberWeight(number);
            weights.put(number, Math.max(0.01, weight)); // Ensure minimum weight
        }
        
        return normalizeWeights(weights);
    }
    
    /**
     * Calculates weight for an individual number using multiple intelligence factors.
     */
    private double calculateIndividualNumberWeight(int number) {
        double droughtWeight = calculateDroughtWeight(number);
        double patternWeight = calculatePatternWeight(number);
        double frequencyWeight = calculateFrequencyWeight(number);
        double randomnessWeight = random.nextGaussian() * 0.1 + 1.0; // Small random factor
        
        return (droughtWeight * DROUGHT_WEIGHT) +
               (patternWeight * PATTERN_WEIGHT) +
               (frequencyWeight * FREQUENCY_WEIGHT) +
               (randomnessWeight * RANDOMNESS_WEIGHT);
    }
    
    /**
     * Calculates drought-based weight for a number.
     * Higher weight for numbers that could help break prize droughts.
     */
    private double calculateDroughtWeight(int number) {
        if (!droughtAnalysis.hasActiveDroughts()) {
            return 1.0; // No drought advantage needed
        }
        
        String highestPriorityTier = droughtAnalysis.getHighestPriorityPrizeTier();
        double tierWeight = droughtAnalysis.getTargetingWeight(highestPriorityTier);
        
        // Favor numbers that historically contribute to the drought tier
        // This is a simplified implementation - in practice, you'd analyze
        // which numbers frequently appear in winning combinations for this tier
        double numberPositionFactor = calculateNumberPositionWeight(number);
        
        return tierWeight * numberPositionFactor;
    }
    
    /**
     * Calculates pattern-based weight for a number.
     * Higher weight for numbers that appear in successful patterns.
     */
    private double calculatePatternWeight(int number) {
        if (!patternAnalysis.hasSignificantData()) {
            return 1.0; // No pattern advantage available
        }
        
        String targetTier = droughtAnalysis.hasActiveDroughts() ? 
            droughtAnalysis.getHighestPriorityPrizeTier() : "match4";
            
        List<String> bestPatterns = patternAnalysis.getBestPatternsForTier(targetTier, 10);
        
        double patternContribution = 0.0;
        int patternCount = 0;
        
        for (String pattern : bestPatterns) {
            if (numberFitsPattern(number, pattern)) {
                patternContribution += 1.0;
            }
            patternCount++;
        }
        
        return patternCount > 0 ? (patternContribution / patternCount) + 1.0 : 1.0;
    }
    
    /**
     * Calculates frequency-based weight for a number.
     * Balances between over-used and under-used numbers.
     */
    private double calculateFrequencyWeight(int number) {
        // This would use historical frequency data
        // For now, we'll use a balanced approach favoring mid-range numbers
        int minNumber = lotteryGame.getMinNumber();
        int maxNumber = lotteryGame.getMaxNumber();
        int midPoint = (minNumber + maxNumber) / 2;
        
        double distanceFromMid = Math.abs(number - midPoint);
        double maxDistance = Math.max(midPoint - minNumber, maxNumber - midPoint);
        
        // Favor numbers closer to the middle range
        return 1.0 + (0.3 * (1.0 - (distanceFromMid / maxDistance)));
    }
    
    /**
     * Calculates positional weight based on lottery number range.
     */
    private double calculateNumberPositionWeight(int number) {
        int minNumber = lotteryGame.getMinNumber();
        int maxNumber = lotteryGame.getMaxNumber();
        int range = maxNumber - minNumber + 1;
        
        // Create positional zones (low, mid-low, middle, mid-high, high)
        int zoneSize = range / 5;
        int position = (number - minNumber) / zoneSize;
        position = Math.min(4, position); // Ensure position is 0-4
        
        // Different zones get different weights based on drought analysis
        double[] zoneWeights = {1.1, 1.0, 1.2, 1.0, 1.1}; // Favor low, middle, and high
        
        return zoneWeights[position];
    }
    
    /**
     * Determines if a number fits a specific pattern.
     */
    private boolean numberFitsPattern(int number, String pattern) {
        // This is a simplified implementation
        // In practice, you'd decode the pattern format and check if the number matches
        // For now, we'll use a hash-based approach for demonstration
        return (pattern.hashCode() + number) % 3 == 0;
    }
    
    /**
     * Normalizes weights so they sum to a reasonable distribution.
     */
    private Map<Integer, Double> normalizeWeights(Map<Integer, Double> weights) {
        double totalWeight = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        
        if (totalWeight == 0.0) {
            // Fallback to uniform distribution
            weights.replaceAll((k, v) -> 1.0);
            totalWeight = weights.size();
        }
        
        final double finalTotalWeight = totalWeight;
        weights.replaceAll((k, v) -> v / finalTotalWeight);
        
        return weights;
    }
    
    /**
     * Selects a number using weighted probability distribution.
     */
    private int selectWeightedNumber(Map<Integer, Double> weights, Set<Integer> excludeNumbers) {
        // Create cumulative probability distribution
        List<Integer> numbers = new ArrayList<>();
        List<Double> cumulativeWeights = new ArrayList<>();
        double cumulative = 0.0;
        
        for (Map.Entry<Integer, Double> entry : weights.entrySet()) {
            if (!excludeNumbers.contains(entry.getKey())) {
                numbers.add(entry.getKey());
                cumulative += entry.getValue();
                cumulativeWeights.add(cumulative);
            }
        }
        
        if (numbers.isEmpty()) {
            // Fallback to any available number
            return IntStream.rangeClosed(lotteryGame.getMinNumber(), lotteryGame.getMaxNumber())
                .filter(n -> !excludeNumbers.contains(n))
                .findFirst()
                .orElse(lotteryGame.getMinNumber());
        }
        
        // Select using weighted random selection
        double randomValue = random.nextDouble() * cumulative;
        
        for (int i = 0; i < cumulativeWeights.size(); i++) {
            if (randomValue <= cumulativeWeights.get(i)) {
                return numbers.get(i);
            }
        }
        
        // Fallback to last number
        return numbers.get(numbers.size() - 1);
    }
    
    /**
     * Adjusts weights to promote diversity after selecting a number.
     */
    private void adjustWeightsForDiversity(Map<Integer, Double> weights, int selectedNumber) {
        // Reduce weight of numbers close to the selected number to promote spread
        int minNumber = lotteryGame.getMinNumber();
        int maxNumber = lotteryGame.getMaxNumber();
        int range = maxNumber - minNumber + 1;
        int diversityRadius = Math.max(1, range / 10); // Adjust based on game range
        
        for (int number = Math.max(minNumber, selectedNumber - diversityRadius);
             number <= Math.min(maxNumber, selectedNumber + diversityRadius);
             number++) {
            
            if (weights.containsKey(number)) {
                double currentWeight = weights.get(number);
                double reductionFactor = 1.0 - (0.3 * (1.0 - Math.abs(number - selectedNumber) / (double) diversityRadius));
                weights.put(number, currentWeight * reductionFactor);
            }
        }
    }
    
    /**
     * Generates numbers using a hybrid approach combining multiple strategies.
     */
    public int[] generateHybridCombination() {
        int drawPositionCount = lotteryGame.getDrawPositionCount();
        
        // Use different strategies for different positions
        int optimizedCount = Math.max(1, drawPositionCount * 2 / 3); // 2/3 optimized
        int randomCount = drawPositionCount - optimizedCount; // 1/3 random
        
        Set<Integer> selectedNumbers = new TreeSet<>();
        
        // Generate optimized numbers
        Map<Integer, Double> weights = calculateNumberWeights(
            lotteryGame.getMinNumber(), lotteryGame.getMaxNumber());
        
        for (int i = 0; i < optimizedCount && selectedNumbers.size() < drawPositionCount; i++) {
            int number = selectWeightedNumber(weights, selectedNumbers);
            selectedNumbers.add(number);
            adjustWeightsForDiversity(weights, number);
        }
        
        // Fill remaining positions with controlled randomness
        while (selectedNumbers.size() < drawPositionCount) {
            int randomNumber = lotteryGame.getMinNumber() + 
                random.nextInt(lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1);
            selectedNumbers.add(randomNumber);
        }
        
        return selectedNumbers.stream().mapToInt(Integer::intValue).toArray();
    }
    
    /**
     * Gets selection statistics for transparency.
     */
    public SelectionStatistics getSelectionStatistics() {
        Map<Integer, Double> weights = calculateNumberWeights(
            lotteryGame.getMinNumber(), lotteryGame.getMaxNumber());
        
        return new SelectionStatistics(
            weights,
            droughtAnalysis.hasActiveDroughts(),
            patternAnalysis.hasSignificantData(),
            droughtAnalysis.getOverallDroughtScore(),
            patternAnalysis.getPatternSuccessRates().size()
        );
    }
    
    /**
     * Statistics class for selection transparency.
     */
    public static class SelectionStatistics {
        private final Map<Integer, Double> numberWeights;
        private final boolean droughtActive;
        private final boolean patternDataAvailable;
        private final double droughtScore;
        private final int availablePatterns;
        
        public SelectionStatistics(Map<Integer, Double> numberWeights, 
                                 boolean droughtActive,
                                 boolean patternDataAvailable,
                                 double droughtScore,
                                 int availablePatterns) {
            this.numberWeights = numberWeights;
            this.droughtActive = droughtActive;
            this.patternDataAvailable = patternDataAvailable;
            this.droughtScore = droughtScore;
            this.availablePatterns = availablePatterns;
        }
        
        public Map<Integer, Double> getNumberWeights() { return numberWeights; }
        public boolean isDroughtActive() { return droughtActive; }
        public boolean isPatternDataAvailable() { return patternDataAvailable; }
        public double getDroughtScore() { return droughtScore; }
        public int getAvailablePatterns() { return availablePatterns; }
        
        public String getSummary() {
            return String.format("Selection Stats: drought=%b (%.2f), patterns=%d, weights=%d numbers",
                droughtActive, droughtScore, availablePatterns, numberWeights.size());
        }
    }
}