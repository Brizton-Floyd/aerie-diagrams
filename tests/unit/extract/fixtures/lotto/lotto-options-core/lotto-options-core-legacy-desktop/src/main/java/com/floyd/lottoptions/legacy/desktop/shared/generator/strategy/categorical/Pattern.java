package com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical;

import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateGroup;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * Represents a categorical pattern in a lottery game, defined by the distribution of numbers across four categories:
 * lower-odd, lower-even, upper-odd, and upper-even. This class encapsulates the structure of a pattern,
 * its theoretical probability, and its performance statistics based on historical data.
 */
@Data
@EqualsAndHashCode(exclude = {"hitCount", "gamesOut", "actualFrequency", "successToFailureRatio", "performanceScore"})
public class Pattern {
    /** The count of numbers in the lower-half that are odd. */
    private final int lowerOdd;
    /** The count of numbers in the lower-half that are even. */
    private final int lowerEven;
    /** The count of numbers in the upper-half that are odd. */
    private final int upperOdd;
    /** The count of numbers in the upper-half that are even. */
    private final int upperEven;
    /** The number of times this pattern has been observed in historical draws. */
    private int hitCount;
    /** The number of draws that have occurred since this pattern was last observed. */
    private int gamesOut;
    /** The theoretical probability of this pattern occurring in a single draw. */
    private final BigDecimal probability;
    /** The expected number of draws before this pattern is expected to hit, based on its probability. */
    private final double expectedElapsedTime;
    /** The midpoint of the number range, used to distinguish the lower half from the upper half. */
    private final int midpoint;
    
    // TemplateMatrix Integration Fields
    /** Template group classification (BEST, GOOD, FAIR, POOR) */
    private TemplateGroup templateGroup;
    
    /** Actual frequency observed in historical data */
    private double actualFrequency;
    
    /** Success-to-failure ratio based on historical performance */
    private double successToFailureRatio;
    
    /** Performance score calculated during historical analysis */
    private double performanceScore;
    
    /** Whether this pattern is currently considered "overdue" */
    private boolean overdue;
    
    /** Timing indicator relative to expected frequency */
    private TimingIndicator timingIndicator;

    /**
     * Constructs a new Pattern with its categorical definition and calculated properties.
     *
     * @param lowerOdd    The count of lower-odd numbers.
     * @param lowerEven   The count of lower-even numbers.
     * @param upperOdd    The count of upper-odd numbers.
     * @param upperEven   The count of upper-even numbers.
     * @param probability The theoretical probability of this pattern.
     * @param midpoint    The midpoint of the game's number range.
     */
    public Pattern(int lowerOdd, int lowerEven, int upperOdd, int upperEven, double probability, int midpoint) {
        this.lowerOdd = lowerOdd;
        this.lowerEven = lowerEven;
        this.upperOdd = upperOdd;
        this.upperEven = upperEven;
        this.probability = BigDecimal.valueOf(probability);
        this.expectedElapsedTime = (probability > 0) ? 1 / probability : Double.POSITIVE_INFINITY;
        this.hitCount = 0;
        this.gamesOut = 0;
        this.midpoint = midpoint;
        
        // Initialize TemplateMatrix fields
        this.templateGroup = TemplateGroup.FAIR; // Default, will be updated during analysis
        this.actualFrequency = 0.0;
        this.successToFailureRatio = 0.0;
        this.performanceScore = 0.0;
        this.overdue = false;
        this.timingIndicator = TimingIndicator.ON_SCHEDULE;
    }

    /**
     * Checks if a given lottery draw matches the categorical definition of this pattern.
     *
     * @param draw An integer array representing the numbers of a lottery draw.
     * @return {@code true} if the draw conforms to the pattern, {@code false} otherwise.
     */
    public boolean matches(int[] draw) {
        int lo = 0, le = 0, uo = 0, ue = 0;
        for (int num : draw) {
            if (num <= midpoint) { // Lower half
                if (num % 2 == 0) le++; else lo++;
            } else { // Upper half
                if (num % 2 == 0) ue++; else uo++;
            }
        }
        return lo == lowerOdd && le == lowerEven && uo == upperOdd && ue == upperEven;
    }

    /** Increments the count of historical hits for this pattern. */
    public void incrementHitCount() { hitCount++; }
    /** Resets the count of games out to zero, typically after a hit. */
    public void resetGamesOut() { gamesOut = 0; }
    /** Increments the count of games that have passed since the last hit. */
    public void incrementGamesOut() { gamesOut++; }
    
    // TemplateMatrix Integration Methods
    
    /**
     * Gets the template pattern as a string representation (e.g., "2-1-1-1").
     */
    public String getPatternString() {
        return String.format("%d-%d-%d-%d", lowerOdd, lowerEven, upperOdd, upperEven);
    }
    
    /**
     * Gets the total number count (should equal lottery pick size).
     */
    public int getTotalNumbers() {
        return lowerOdd + lowerEven + upperOdd + upperEven;
    }
    
    /**
     * Updates hit statistics when this pattern appears in a draw.
     */
    public void recordHit() {
        hitCount++;
        gamesOut = 0;
        updateTimingIndicator();
    }
    
    /**
     * Updates actual frequency based on total draws analyzed.
     */
    public void updateActualFrequency(int totalDraws) {
        this.actualFrequency = totalDraws > 0 ? (double) hitCount / totalDraws : 0.0;
    }
    
    /**
     * Updates the success-to-failure ratio.
     */
    public void updateSuccessToFailureRatio() {
        int failures = gamesOut > 0 ? gamesOut : 1;
        this.successToFailureRatio = hitCount > 0 ? (double) hitCount / failures : 0.0;
    }
    
    /**
     * Updates timing indicator based on current games out vs expected frequency.
     */
    private void updateTimingIndicator() {
        if (expectedElapsedTime == Double.POSITIVE_INFINITY) {
            timingIndicator = TimingIndicator.UNKNOWN;
            return;
        }
        
        double expectedGamesOut = expectedElapsedTime;
        
        if (gamesOut > expectedGamesOut * 1.5) {
            timingIndicator = TimingIndicator.OVERDUE;
            overdue = true;
        } else if (gamesOut > expectedGamesOut * 1.2) {
            timingIndicator = TimingIndicator.APPROACHING_DUE;
            overdue = false;
        } else if (gamesOut < expectedGamesOut * 0.5) {
            timingIndicator = TimingIndicator.RECENTLY_HIT;
            overdue = false;
        } else {
            timingIndicator = TimingIndicator.ON_SCHEDULE;
            overdue = false;
        }
    }
    
    /**
     * Gets probability as a percentage string.
     */
    public String getProbabilityPercentage() {
        return probability.multiply(BigDecimal.valueOf(100))
                .setScale(2, java.math.RoundingMode.HALF_UP) + "%";
    }
    
    /**
     * Gets performance deviation from expected frequency.
     */
    public double getPerformanceDeviation() {
        double expected = 1.0 / probability.doubleValue();
        return actualFrequency > 0 ? (actualFrequency - expected) / expected : 0.0;
    }
    
    /**
     * Determines if this pattern should be used in generation based on its group and timing.
     */
    public boolean isRecommendedForGeneration() {
        return templateGroup != null && templateGroup.isRecommendedForGeneration() && 
               timingIndicator != TimingIndicator.RECENTLY_HIT;
    }

    @Override
    public String toString() {
        String baseInfo = String.format("Pattern [LO: %d, LE: %d, UO: %d, UE: %d] - Hits: %d, Out: %d, Prob: %s, EET: %.2f",
                lowerOdd, lowerEven, upperOdd, upperEven, hitCount, gamesOut, probability.toPlainString(), expectedElapsedTime);
        
        // Add TemplateMatrix info if available
        if (templateGroup != null) {
            return baseInfo + String.format(", Group: %s, Timing: %s", templateGroup, timingIndicator);
        }
        return baseInfo;
    }
    
    /**
     * Enum for timing indicators relative to expected frequency.
     */
    public enum TimingIndicator {
        OVERDUE("Overdue - likely to appear soon"),
        APPROACHING_DUE("Approaching due - moderate likelihood"),
        ON_SCHEDULE("On schedule - normal likelihood"),
        RECENTLY_HIT("Recently hit - lower likelihood"),
        UNKNOWN("Unknown - insufficient data");
        
        private final String description;
        
        TimingIndicator(String description) {
            this.description = description;
        }
        
        public String getDescription() {
            return description;
        }
    }
}