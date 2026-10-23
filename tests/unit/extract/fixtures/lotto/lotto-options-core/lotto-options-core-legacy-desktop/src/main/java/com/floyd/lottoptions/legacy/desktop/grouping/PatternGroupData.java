package com.floyd.lottoptions.legacy.desktop.grouping;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Data structure that holds classified pattern groups for a specific lottery game.
 * Contains HOT, WARM, and COLD pattern groups with metadata about the analysis.
 */
public class PatternGroupData {
    
    private final String lotteryConfigId;
    private final int totalAnalyzedDraws;
    private final LocalDateTime lastAnalysisDate;
    private final Map<String, PatternGroup> groups;

    /**
     * Constructs PatternGroupData with analysis results.
     *
     * @param lotteryConfigId The lottery game identifier
     * @param totalAnalyzedDraws Total number of draws analyzed
     * @param groups Map of pattern groups (HOT, WARM, COLD)
     */
    public PatternGroupData(String lotteryConfigId, int totalAnalyzedDraws, Map<String, PatternGroup> groups) {
        this.lotteryConfigId = Objects.requireNonNull(lotteryConfigId, "lotteryConfigId cannot be null");
        Objects.requireNonNull(groups, "groups cannot be null");
        
        if (totalAnalyzedDraws < 0) {
            throw new IllegalArgumentException("totalAnalyzedDraws must be non-negative, got: " + totalAnalyzedDraws);
        }
        
        this.totalAnalyzedDraws = totalAnalyzedDraws;
        this.lastAnalysisDate = LocalDateTime.now();
        this.groups = Collections.unmodifiableMap(new HashMap<>(groups));
    }

    /**
     * Gets the lottery configuration ID.
     *
     * @return The lottery game identifier
     */
    public String getLotteryConfigId() {
        return lotteryConfigId;
    }

    /**
     * Gets the total number of draws analyzed.
     *
     * @return Total analyzed draws
     */
    public int getTotalAnalyzedDraws() {
        return totalAnalyzedDraws;
    }

    /**
     * Gets the date when this analysis was performed.
     *
     * @return The analysis date
     */
    public LocalDateTime getLastAnalysisDate() {
        return lastAnalysisDate;
    }

    /**
     * Gets all pattern groups.
     *
     * @return Map of pattern groups keyed by type (HOT, WARM, COLD)
     */
    public Map<String, PatternGroup> getGroups() {
        return groups;
    }

    /**
     * Gets the HOT pattern group.
     *
     * @return Optional containing the HOT pattern group, or empty if not present
     */
    public Optional<PatternGroup> getHotPatterns() {
        return Optional.ofNullable(groups.get("HOT"));
    }

    /**
     * Gets the WARM pattern group.
     *
     * @return Optional containing the WARM pattern group, or empty if not present
     */
    public Optional<PatternGroup> getWarmPatterns() {
        return Optional.ofNullable(groups.get("WARM"));
    }

    /**
     * Gets the COLD pattern group.
     *
     * @return Optional containing the COLD pattern group, or empty if not present
     */
    public Optional<PatternGroup> getColdPatterns() {
        return Optional.ofNullable(groups.get("COLD"));
    }

    /**
     * Finds which group contains a specific pattern.
     *
     * @param pattern The pattern to search for
     * @return Optional containing the group type (HOT, WARM, COLD), or empty if not found
     */
    public Optional<String> findPatternGroupType(String pattern) {
        Objects.requireNonNull(pattern, "pattern cannot be null");
        
        for (Map.Entry<String, PatternGroup> entry : groups.entrySet()) {
            if (entry.getValue().contains(pattern)) {
                return Optional.of(entry.getKey());
            }
        }
        return Optional.empty();
    }

    /**
     * Gets the pattern group that contains a specific pattern.
     *
     * @param pattern The pattern to search for
     * @return Optional containing the PatternGroup with the pattern, or empty if not found
     */
    public Optional<PatternGroup> findPatternGroup(String pattern) {
        Objects.requireNonNull(pattern, "pattern cannot be null");
        
        for (PatternGroup group : groups.values()) {
            if (group.contains(pattern)) {
                return Optional.of(group);
            }
        }
        return Optional.empty();
    }

    /**
     * Checks if the pattern group data is stale based on the maximum age.
     *
     * @param maxAgeDays Maximum age in days before data is considered stale
     * @return true if the data is older than maxAgeDays
     */
    public boolean isStale(int maxAgeDays) {
        return lastAnalysisDate.isBefore(LocalDateTime.now().minusDays(maxAgeDays));
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PatternGroupData that = (PatternGroupData) o;
        return totalAnalyzedDraws == that.totalAnalyzedDraws &&
               Objects.equals(lotteryConfigId, that.lotteryConfigId) &&
               Objects.equals(groups, that.groups);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(lotteryConfigId, totalAnalyzedDraws, groups);
    }
    
    @Override
    public String toString() {
        return String.format("PatternGroupData{configId='%s', totalDraws=%d, groups=%d, analysisDate=%s}",
                lotteryConfigId, totalAnalyzedDraws, groups.size(), lastAnalysisDate);
    }
}