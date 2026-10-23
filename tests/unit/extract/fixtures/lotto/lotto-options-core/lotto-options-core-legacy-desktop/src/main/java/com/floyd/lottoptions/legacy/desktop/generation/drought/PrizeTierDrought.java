package com.floyd.lottoptions.legacy.desktop.generation.drought;

import java.time.LocalDate;

/**
 * Represents drought analysis results for a specific prize tier.
 * Contains information about how long since the prize tier last occurred
 * and whether it's considered to be in a drought condition.
 */
public class PrizeTierDrought {
    
    private final String prizeTier;
    private final int daysSinceLastOccurrence;
    private final double expectedDays;
    private final double droughtSeverity;
    private final boolean inDrought;
    private final LocalDate lastOccurrenceDate;
    
    public PrizeTierDrought(String prizeTier, int daysSinceLastOccurrence, double expectedDays,
                           double droughtSeverity, boolean inDrought, LocalDate lastOccurrenceDate) {
        this.prizeTier = prizeTier;
        this.daysSinceLastOccurrence = daysSinceLastOccurrence;
        this.expectedDays = expectedDays;
        this.droughtSeverity = droughtSeverity;
        this.inDrought = inDrought;
        this.lastOccurrenceDate = lastOccurrenceDate;
    }
    
    /**
     * Gets the prize tier identifier (e.g., "match3", "match4", "match5", "jackpot").
     */
    public String getPrizeTier() {
        return prizeTier;
    }
    
    /**
     * Gets the number of days since this prize tier last occurred.
     */
    public int getDaysSinceLastOccurrence() {
        return daysSinceLastOccurrence;
    }
    
    /**
     * Gets the expected number of days between occurrences for this prize tier.
     */
    public double getExpectedDays() {
        return expectedDays;
    }
    
    /**
     * Gets the drought severity score (daysSinceLastOccurrence / expectedDays).
     * Values > 1.0 indicate the prize is overdue.
     */
    public double getDroughtSeverity() {
        return droughtSeverity;
    }
    
    /**
     * Returns true if this prize tier is considered to be in drought condition.
     */
    public boolean isInDrought() {
        return inDrought;
    }
    
    /**
     * Gets the date when this prize tier last occurred (null if never found).
     */
    public LocalDate getLastOccurrenceDate() {
        return lastOccurrenceDate;
    }
    
    /**
     * Gets a human-readable description of the drought condition.
     */
    public String getDroughtDescription() {
        if (!inDrought) {
            return "Normal - appeared recently";
        }
        
        if (droughtSeverity >= 3.0) {
            return "Severe drought - extremely overdue";
        } else if (droughtSeverity >= 2.0) {
            return "Moderate drought - significantly overdue";
        } else {
            return "Mild drought - somewhat overdue";
        }
    }
    
    @Override
    public String toString() {
        return String.format("PrizeTierDrought{tier='%s', daysSince=%d, expected=%.1f, severity=%.2f, inDrought=%s}", 
                           prizeTier, daysSinceLastOccurrence, expectedDays, droughtSeverity, inDrought);
    }
}