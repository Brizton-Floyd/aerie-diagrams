package com.floyd.lottoptions.legacy.desktop.shared.template;

import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Represents a TemplateMatrix template - a mathematical pattern based on the distribution
 * of numbers across four categories: Low-Odd, Low-Even, High-Odd, High-Even.
 * 
 * This class extends the concept of lottery patterns by adding probability calculations,
 * historical performance tracking, and group classification for intelligent selection.
 */
@Data
@EqualsAndHashCode(exclude = {"hitCount", "gamesOut", "actualFrequency", "successToFailureRatio"})
public class TemplateMatrixTemplate {
    
    /** Count of numbers in the lower-half that are odd */
    private final int lowOdd;
    
    /** Count of numbers in the lower-half that are even */
    private final int lowEven;
    
    /** Count of numbers in the upper-half that are odd */
    private final int highOdd;
    
    /** Count of numbers in the upper-half that are even */
    private final int highEven;
    
    /** Mathematical probability of this template occurring */
    private final BigDecimal probability;
    
    /** Expected frequency - how often this template should appear */
    private final double expectedFrequency;
    
    /** The midpoint dividing low/high number ranges */
    private final int midpoint;
    
    /** Template group classification (BEST, GOOD, FAIR, POOR) */
    private TemplateGroup templateGroup;
    
    /** Number of times this template has appeared in historical data */
    private int hitCount;
    
    /** Number of draws since this template last appeared */
    private int gamesOut;
    
    /** Actual frequency observed in historical data */
    private double actualFrequency;
    
    /** Success-to-failure ratio based on historical performance */
    private double successToFailureRatio;
    
    /** Whether this template is currently considered "overdue" */
    private boolean overdue;
    
    /** Timing indicator relative to expected frequency */
    private TimingIndicator timingIndicator;
    
    /** Performance score calculated during historical analysis */
    private double performanceScore;
    
    /**
     * Constructs a new TemplateMatrix template with mathematical properties.
     */
    public TemplateMatrixTemplate(int lowOdd, int lowEven, int highOdd, int highEven, 
                                  double probability, int midpoint) {
        this.lowOdd = lowOdd;
        this.lowEven = lowEven;
        this.highOdd = highOdd;
        this.highEven = highEven;
        this.probability = BigDecimal.valueOf(probability).setScale(6, RoundingMode.HALF_UP);
        this.expectedFrequency = (probability > 0) ? 1.0 / probability : Double.POSITIVE_INFINITY;
        this.midpoint = midpoint;
        
        // Initialize tracking fields
        this.hitCount = 0;
        this.gamesOut = 0;
        this.actualFrequency = 0.0;
        this.successToFailureRatio = 0.0;
        this.overdue = false;
        this.timingIndicator = TimingIndicator.ON_SCHEDULE;
        this.templateGroup = TemplateGroup.FAIR; // Default, will be updated during analysis
        this.performanceScore = 0.0;
    }
    
    /**
     * Gets the template pattern as a string representation (e.g., "2-1-1-1").
     */
    public String getPatternString() {
        return String.format("%d-%d-%d-%d", lowOdd, lowEven, highOdd, highEven);
    }
    
    /**
     * Gets the total number count (should equal lottery pick size).
     */
    public int getTotalNumbers() {
        return lowOdd + lowEven + highOdd + highEven;
    }
    
    /**
     * Checks if a lottery draw matches this template pattern.
     * 
     * @param draw Array of lottery numbers
     * @return true if the draw matches this template
     */
    public boolean matches(int[] draw) {
        int countLO = 0, countLE = 0, countHO = 0, countHE = 0;
        
        for (int number : draw) {
            if (number <= midpoint) {
                // Low numbers
                if (number % 2 == 1) {
                    countLO++; // Low Odd
                } else {
                    countLE++; // Low Even
                }
            } else {
                // High numbers
                if (number % 2 == 1) {
                    countHO++; // High Odd
                } else {
                    countHE++; // High Even
                }
            }
        }
        
        return countLO == lowOdd && countLE == lowEven && 
               countHO == highOdd && countHE == highEven;
    }
    
    /**
     * Updates hit statistics when this template appears in a draw.
     */
    public void recordHit() {
        hitCount++;
        gamesOut = 0;
        updateTimingIndicator();
    }
    
    /**
     * Updates games out counter when a draw doesn't match this template.
     */
    public void incrementGamesOut() {
        gamesOut++;
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
        if (expectedFrequency == Double.POSITIVE_INFINITY) {
            timingIndicator = TimingIndicator.UNKNOWN;
            return;
        }
        
        double expectedGamesOut = expectedFrequency;
        
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
                .setScale(2, RoundingMode.HALF_UP) + "%";
    }
    
    /**
     * Gets performance deviation from expected frequency.
     */
    public double getPerformanceDeviation() {
        double expected = 1.0 / probability.doubleValue();
        return actualFrequency > 0 ? (actualFrequency - expected) / expected : 0.0;
    }
    
    /**
     * Determines if this template should be used in generation based on its group and timing.
     */
    public boolean isRecommendedForGeneration() {
        return templateGroup.isRecommendedForGeneration() && 
               timingIndicator != TimingIndicator.RECENTLY_HIT;
    }

    // Getter and setter methods (to complement Lombok @Data)
    public TemplateGroup getTemplateGroup() {
        return templateGroup;
    }
    
    public void setTemplateGroup(TemplateGroup templateGroup) {
        this.templateGroup = templateGroup;
    }
    
    public int getHitCount() {
        return hitCount;
    }
    
    public void setHitCount(int hitCount) {
        this.hitCount = hitCount;
    }
    
    public int getGamesOut() {
        return gamesOut;
    }
    
    public void setGamesOut(int gamesOut) {
        this.gamesOut = gamesOut;
    }
    
    public double getActualFrequency() {
        return actualFrequency;
    }
    
    public void setActualFrequency(double actualFrequency) {
        this.actualFrequency = actualFrequency;
    }
    
    public double getSuccessToFailureRatio() {
        return successToFailureRatio;
    }
    
    public void setSuccessToFailureRatio(double successToFailureRatio) {
        this.successToFailureRatio = successToFailureRatio;
    }
    
    public boolean isOverdue() {
        return overdue;
    }
    
    public void setOverdue(boolean overdue) {
        this.overdue = overdue;
    }
    
    public double getPerformanceScore() {
        return performanceScore;
    }
    
    public void setPerformanceScore(double performanceScore) {
        this.performanceScore = performanceScore;
    }
    
    public BigDecimal getProbability() {
        return probability;
    }
    
    @Override
    public String toString() {
        return String.format("TemplateMatrix[%s] - Group: %s, Prob: %s, Hits: %d, Out: %d, Timing: %s", 
                           getPatternString(), templateGroup, getProbabilityPercentage(), 
                           hitCount, gamesOut, timingIndicator);
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