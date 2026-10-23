package com.floyd.lottoptions.legacy.desktop.shared.template;

/**
 * Represents the classification groups for TemplateMatrix templates based on their
 * mathematical probability and historical performance characteristics.
 */
public enum TemplateGroup {
    
    /**
     * Best performing templates with highest probability and best success ratios.
     * These templates appear most frequently and have the best historical performance.
     */
    BEST("Best", "Highest probability templates with best performance", 1),
    
    /**
     * Good performing templates with above-average probability and performance.
     * These templates offer good balance between frequency and success ratios.
     */
    GOOD("Good", "Above-average probability templates with good performance", 2),
    
    /**
     * Fair performing templates with average probability and performance.
     * These templates appear occasionally with moderate success ratios.
     */
    FAIR("Fair", "Average probability templates with fair performance", 3),
    
    /**
     * Poor performing templates with low probability and poor success ratios.
     * These templates appear infrequently and should generally be avoided.
     */
    POOR("Poor", "Low probability templates with poor performance", 4);
    
    private final String displayName;
    private final String description;
    private final int priority;
    
    TemplateGroup(String displayName, String description, int priority) {
        this.displayName = displayName;
        this.description = description;
        this.priority = priority;
    }
    
    /**
     * Gets the human-readable display name.
     */
    public String getDisplayName() {
        return displayName;
    }
    
    /**
     * Gets the detailed description of this template group.
     */
    public String getDescription() {
        return description;
    }
    
    /**
     * Gets the priority level (lower number = higher priority).
     */
    public int getPriority() {
        return priority;
    }
    
    /**
     * Determines template group based on probability percentile.
     * 
     * @param probabilityPercentile The percentile ranking of the template's probability (0.0 to 1.0)
     * @return The appropriate template group
     */
    public static TemplateGroup fromProbabilityPercentile(double probabilityPercentile) {
        if (probabilityPercentile >= 0.75) {
            return BEST;
        } else if (probabilityPercentile >= 0.50) {
            return GOOD;
        } else if (probabilityPercentile >= 0.25) {
            return FAIR;
        } else {
            return POOR;
        }
    }
    
    /**
     * Determines if this group should be included in generation by default.
     */
    public boolean isRecommendedForGeneration() {
        return this == BEST || this == GOOD;
    }
    
    /**
     * Gets the weight multiplier for this group in generation selection.
     */
    public double getSelectionWeight() {
        switch (this) {
            case BEST: return 4.0;
            case GOOD: return 2.5;
            case FAIR: return 1.0;
            case POOR: return 0.25;
            default: return 1.0;
        }
    }
}