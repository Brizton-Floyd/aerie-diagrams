package com.floyd.lottoptions.legacy.desktop.generation.delta;

import com.floyd.persistence.model.LotteryGame;

/**
 * Dynamic scaling calculator for delta patterns across any lottery format.
 * Implements the universal scaling algorithm that adapts proven 5/35 base patterns
 * to work with any lottery game configuration.
 * 
 * Based on proven delta methodology where base patterns are scaled proportionally
 * to maintain mathematical relationships across different lottery formats.
 */
public class DeltaScalingCalculator {
    
    // Base reference format that all patterns are scaled from
    private static final int BASE_MAX_NUMBER = 35;
    private static final int BASE_PICK_COUNT = 5;
    
    // Dynamic range calculations as percentages of MAX_NUMBER
    private static final double LOW_START_PERCENTAGE = 0.10;  // 10% of range for optimal start
    private static final double HIGH_END_MIN_PERCENTAGE = 0.80; // 80% of range for optimal end
    private static final double OPTIMAL_SPREAD_MIN_PERCENTAGE = 0.60; // 60% minimum spread
    private static final double OPTIMAL_SPREAD_MAX_PERCENTAGE = 0.90; // 90% maximum spread
    
    private final LotteryGame lotteryGame;
    private final double scalingFactor;
    private final DeltaScalingConfig scalingConfig;
    
    /**
     * Creates a scaling calculator for the specified lottery game.
     * 
     * @param lotteryGame The lottery game to calculate scaling for
     */
    public DeltaScalingCalculator(LotteryGame lotteryGame) {
        this.lotteryGame = lotteryGame;
        this.scalingFactor = calculateScalingFactor();
        this.scalingConfig = calculateScalingConfig();
    }
    
    /**
     * Calculates the primary scaling factor based on number range.
     * 
     * @return Scaling factor (e.g., 1.4 for 6/49, 1.11 for 5/39)
     */
    public double getScalingFactor() {
        return scalingFactor;
    }
    
    /**
     * Gets the complete scaling configuration for this lottery game.
     * 
     * @return Configuration object with all calculated scaling parameters
     */
    public DeltaScalingConfig getScalingConfig() {
        return scalingConfig;
    }
    
    /**
     * Scales a delta pattern from base format to target lottery format.
     * 
     * @param baseDeltaPattern Base pattern (e.g., [1,6,9,9,9])
     * @return Scaled pattern for target lottery format
     */
    public int[] scalePattern(int[] baseDeltaPattern) {
        if (baseDeltaPattern == null || baseDeltaPattern.length == 0) {
            return new int[0];
        }
        
        int[] scaledPattern = new int[lotteryGame.getDrawPositionCount()];
        
        // Scale first delta (starting number) to optimal low range
        scaledPattern[0] = scaleStartingNumber(baseDeltaPattern[0]);
        
        // Scale remaining deltas (gaps) proportionally
        for (int i = 1; i < scaledPattern.length && i < baseDeltaPattern.length; i++) {
            scaledPattern[i] = scaleGap(baseDeltaPattern[i]);
        }
        
        // For patterns that need extension (e.g., 5 picks to 7 picks)
        if (scaledPattern.length > baseDeltaPattern.length) {
            extendPattern(scaledPattern, baseDeltaPattern);
        }
        
        return scaledPattern;
    }
    
    /**
     * Converts scaled delta pattern to actual lottery numbers.
     * 
     * @param deltaPattern Scaled delta pattern
     * @return Array of lottery numbers, or null if pattern invalid
     */
    public int[] deltaPatternToLotteryNumbers(int[] deltaPattern) {
        if (deltaPattern == null || deltaPattern.length == 0) {
            return null;
        }
        
        int[] lotteryNumbers = new int[deltaPattern.length];
        int currentNumber = deltaPattern[0]; // First delta is starting number
        lotteryNumbers[0] = currentNumber;
        
        // Build subsequent numbers by adding deltas
        for (int i = 1; i < deltaPattern.length; i++) {
            currentNumber += deltaPattern[i];
            
            // Validate number is within lottery range
            if (currentNumber > lotteryGame.getMaxNumber()) {
                return null; // Invalid pattern - exceeds range
            }
            
            lotteryNumbers[i] = currentNumber;
        }
        
        // Final validation - ensure ending number is in optimal range
        if (!isValidFinalNumber(lotteryNumbers[lotteryNumbers.length - 1])) {
            return adjustForOptimalEnding(lotteryNumbers);
        }
        
        return lotteryNumbers;
    }
    
    /**
     * Calculates optimal gap range for this lottery format.
     * 
     * @return Array with [minGap, maxGap] for optimal performance
     */
    public int[] getOptimalGapRange() {
        return scalingConfig.getOptimalGapRange();
    }
    
    /**
     * Calculates optimal starting number range.
     * 
     * @return Array with [minStart, maxStart] for optimal performance
     */
    public int[] getOptimalStartRange() {
        return scalingConfig.getOptimalStartRange();
    }
    
    /**
     * Calculates optimal ending number range.
     * 
     * @return Array with [minEnd, maxEnd] for optimal performance
     */
    public int[] getOptimalEndRange() {
        return scalingConfig.getOptimalEndRange();
    }
    
    // Private helper methods
    
    private double calculateScalingFactor() {
        return (double) lotteryGame.getMaxNumber() / BASE_MAX_NUMBER;
    }
    
    private DeltaScalingConfig calculateScalingConfig() {
        int numberRange = lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1;
        
        // Calculate optimal ranges dynamically
        int optimalStartMin = lotteryGame.getMinNumber();
        int optimalStartMax = (int) Math.ceil(lotteryGame.getMinNumber() + (numberRange * LOW_START_PERCENTAGE));
        
        int optimalEndMin = (int) Math.floor(lotteryGame.getMaxNumber() * HIGH_END_MIN_PERCENTAGE);
        int optimalEndMax = lotteryGame.getMaxNumber();
        
        // Calculate optimal gap range based on scaling and number of picks
        int baseOptimalGapMin = 6; // From proven 5/35 analysis
        int baseOptimalGapMax = 9; // From proven 5/35 analysis
        
        // Adjust for larger number of picks - gaps should be smaller when more picks are needed
        double pickAdjustment = (double) BASE_PICK_COUNT / lotteryGame.getDrawPositionCount();
        
        int optimalGapMin = (int) Math.max(1, Math.round(baseOptimalGapMin * scalingFactor * pickAdjustment));
        int optimalGapMax = (int) Math.round(baseOptimalGapMax * scalingFactor * pickAdjustment);
        
        return new DeltaScalingConfig(
            scalingFactor,
            new int[]{optimalStartMin, optimalStartMax},
            new int[]{optimalEndMin, optimalEndMax},
            new int[]{optimalGapMin, optimalGapMax},
            (int) Math.floor(numberRange * OPTIMAL_SPREAD_MIN_PERCENTAGE),
            (int) Math.floor(numberRange * OPTIMAL_SPREAD_MAX_PERCENTAGE)
        );
    }
    
    private int scaleStartingNumber(int baseStartingNumber) {
        // Scale starting number to optimal low range
        int scaledStart = (int) Math.round(baseStartingNumber * scalingFactor);
        
        // Ensure it's in optimal starting range
        int[] startRange = scalingConfig.getOptimalStartRange();
        return Math.max(startRange[0], Math.min(startRange[1], scaledStart));
    }
    
    private int scaleGap(int baseGap) {
        // More conservative gap scaling to prevent exceeding lottery range
        double conservativeScaling = Math.min(scalingFactor, scalingFactor * 0.8); // Reduce scaling by 20%
        int scaledGap = (int) Math.round(baseGap * conservativeScaling);
        
        // Ensure gap is in optimal range but also conservative
        int[] gapRange = scalingConfig.getOptimalGapRange();
        int maxGap = Math.min(gapRange[1], (lotteryGame.getMaxNumber() - lotteryGame.getMinNumber()) / lotteryGame.getDrawPositionCount());
        
        return Math.max(gapRange[0], Math.min(maxGap, scaledGap));
    }
    
    private void extendPattern(int[] scaledPattern, int[] baseDeltaPattern) {
        // For patterns that need more picks than base pattern provides
        // Use intelligent extension that maintains pattern characteristics
        if (baseDeltaPattern.length > 1) {
            // Calculate average gap from the base pattern (excluding first element which is starting number)
            double avgGap = 0.0;
            for (int i = 1; i < baseDeltaPattern.length; i++) {
                avgGap += baseDeltaPattern[i];
            }
            avgGap /= (baseDeltaPattern.length - 1);
            
            // Scale the average gap
            int scaledAvgGap = scaleGap((int) Math.round(avgGap));
            
            // Extend with slightly varying gaps around the average
            for (int i = baseDeltaPattern.length; i < scaledPattern.length; i++) {
                // Add slight variation to prevent perfect arithmetic progression if not intended
                int variation = (i % 2 == 0) ? 0 : ((i % 4 == 1) ? -1 : 1);
                scaledPattern[i] = Math.max(1, scaledAvgGap + variation);
            }
        }
    }
    
    private boolean isValidFinalNumber(int finalNumber) {
        int[] endRange = scalingConfig.getOptimalEndRange();
        return finalNumber >= endRange[0] && finalNumber <= endRange[1];
    }
    
    private int[] adjustForOptimalEnding(int[] lotteryNumbers) {
        // Try to adjust the pattern to achieve optimal ending
        // This is a more intelligent approach that scales down gaps proportionally
        int[] endRange = scalingConfig.getOptimalEndRange();
        int maxAllowedEnd = lotteryGame.getMaxNumber();
        int currentEnd = lotteryNumbers[lotteryNumbers.length - 1];
        
        if (currentEnd <= maxAllowedEnd) {
            return lotteryNumbers; // Already valid
        }
        
        // Calculate scale-down factor needed
        int totalSpread = currentEnd - lotteryNumbers[0];
        int maxAllowedSpread = maxAllowedEnd - lotteryNumbers[0];
        
        if (maxAllowedSpread <= 0) {
            return null; // Cannot fit in range
        }
        
        double scaleDownFactor = (double) maxAllowedSpread / totalSpread;
        
        // Apply proportional scaling to create valid pattern
        int[] adjustedNumbers = new int[lotteryNumbers.length];
        adjustedNumbers[0] = lotteryNumbers[0]; // Keep starting number
        
        for (int i = 1; i < lotteryNumbers.length; i++) {
            int originalDistance = lotteryNumbers[i] - lotteryNumbers[0];
            int scaledDistance = (int) Math.round(originalDistance * scaleDownFactor);
            adjustedNumbers[i] = adjustedNumbers[0] + scaledDistance;
            
            // Ensure we don't exceed bounds and maintain order
            if (adjustedNumbers[i] > maxAllowedEnd) {
                adjustedNumbers[i] = maxAllowedEnd - (lotteryNumbers.length - i - 1);
            }
            
            // Ensure ascending order
            if (i > 1 && adjustedNumbers[i] <= adjustedNumbers[i-1]) {
                adjustedNumbers[i] = adjustedNumbers[i-1] + 1;
            }
        }
        
        // Final validation
        if (adjustedNumbers[adjustedNumbers.length - 1] > maxAllowedEnd) {
            return null;
        }
        
        return adjustedNumbers;
    }
    
    /**
     * Configuration object containing all scaling parameters for a lottery game.
     */
    public static class DeltaScalingConfig {
        private final double scalingFactor;
        private final int[] optimalStartRange;
        private final int[] optimalEndRange;
        private final int[] optimalGapRange;
        private final int minOptimalSpread;
        private final int maxOptimalSpread;
        
        public DeltaScalingConfig(double scalingFactor, int[] optimalStartRange, 
                                int[] optimalEndRange, int[] optimalGapRange,
                                int minOptimalSpread, int maxOptimalSpread) {
            this.scalingFactor = scalingFactor;
            this.optimalStartRange = optimalStartRange;
            this.optimalEndRange = optimalEndRange;
            this.optimalGapRange = optimalGapRange;
            this.minOptimalSpread = minOptimalSpread;
            this.maxOptimalSpread = maxOptimalSpread;
        }
        
        public double getScalingFactor() { return scalingFactor; }
        public int[] getOptimalStartRange() { return optimalStartRange; }
        public int[] getOptimalEndRange() { return optimalEndRange; }
        public int[] getOptimalGapRange() { return optimalGapRange; }
        public int getMinOptimalSpread() { return minOptimalSpread; }
        public int getMaxOptimalSpread() { return maxOptimalSpread; }
        
        @Override
        public String toString() {
            return String.format("DeltaScalingConfig{scale=%.2f, start=%d-%d, end=%d-%d, gaps=%d-%d}",
                scalingFactor, optimalStartRange[0], optimalStartRange[1],
                optimalEndRange[0], optimalEndRange[1],
                optimalGapRange[0], optimalGapRange[1]);
        }
    }
}