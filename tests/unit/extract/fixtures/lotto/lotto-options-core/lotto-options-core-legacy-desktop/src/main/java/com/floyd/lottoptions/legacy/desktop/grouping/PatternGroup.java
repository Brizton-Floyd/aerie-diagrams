package com.floyd.lottoptions.legacy.desktop.grouping;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Represents a group of lottery patterns classified by their performance characteristics.
 * Patterns can be classified as HOT (frequently appearing), WARM (moderate frequency), 
 * or COLD (rarely appearing or overdue).
 */
public class PatternGroup {
    
    private final List<String> patterns;
    private final List<Integer> frequency;
    private final double efficiencyMultiplier;
    private final LocalDateTime lastUpdated;

    /**
     * Constructs a PatternGroup with specified patterns and their characteristics.
     *
     * @param patterns List of pattern strings (e.g., ["01223", "01234"])
     * @param frequency List of frequencies corresponding to each pattern
     * @param efficiencyMultiplier Multiplier for quality scoring (HOT=1.2, WARM=1.0, COLD=0.8)
     */
    @JsonCreator
    public PatternGroup(@JsonProperty("patterns") List<String> patterns, 
                       @JsonProperty("frequency") List<Integer> frequency, 
                       @JsonProperty("efficiencyMultiplier") double efficiencyMultiplier) {
        Objects.requireNonNull(patterns, "patterns cannot be null");
        Objects.requireNonNull(frequency, "frequency cannot be null");
        
        if (patterns.size() != frequency.size()) {
            throw new IllegalArgumentException(
                String.format("Patterns size (%d) must match frequency size (%d)",
                    patterns.size(), frequency.size()));
        }
        
        this.patterns = Collections.unmodifiableList(new ArrayList<>(patterns));
        this.frequency = Collections.unmodifiableList(new ArrayList<>(frequency));
        this.efficiencyMultiplier = efficiencyMultiplier;
        this.lastUpdated = LocalDateTime.now();
    }

    /**
     * Gets the list of patterns in this group.
     *
     * @return List of pattern strings
     */
    @JsonProperty("patterns")
    public List<String> getPatterns() {
        return patterns;
    }

    /**
     * Gets the frequency list for patterns in this group.
     *
     * @return List of frequencies corresponding to each pattern
     */
    @JsonProperty("frequency")
    public List<Integer> getFrequency() {
        return frequency;
    }

    /**
     * Gets the efficiency multiplier for this pattern group.
     * Used in quality scoring calculations.
     *
     * @return The efficiency multiplier (HOT=1.2, WARM=1.0, COLD=0.8)
     */
    @JsonProperty("efficiencyMultiplier")
    public double getEfficiencyMultiplier() {
        return efficiencyMultiplier;
    }

    /**
     * Gets the timestamp when this pattern group was last updated.
     *
     * @return The last updated timestamp
     */
    public LocalDateTime getLastUpdated() {
        return lastUpdated;
    }

    /**
     * Checks if this pattern group contains a specific pattern.
     *
     * @param pattern The pattern string to search for
     * @return true if the pattern is found in this group
     */
    public boolean contains(String pattern) {
        return patterns.contains(pattern);
    }

    /**
     * Gets the frequency of a specific pattern in this group.
     *
     * @param pattern The pattern to look up
     * @return The frequency of the pattern, or 0 if not found
     */
    public int getPatternFrequency(String pattern) {
        int index = patterns.indexOf(pattern);
        if (index >= 0 && index < frequency.size()) {
            return frequency.get(index);
        }
        return 0;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PatternGroup that = (PatternGroup) o;
        return Double.compare(that.efficiencyMultiplier, efficiencyMultiplier) == 0 &&
               Objects.equals(patterns, that.patterns) &&
               Objects.equals(frequency, that.frequency);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(patterns, frequency, efficiencyMultiplier);
    }
    
    @Override
    public String toString() {
        return String.format("PatternGroup{patterns=%d, efficiencyMultiplier=%.1f, lastUpdated=%s}",
                patterns.size(), efficiencyMultiplier, lastUpdated);
    }
}