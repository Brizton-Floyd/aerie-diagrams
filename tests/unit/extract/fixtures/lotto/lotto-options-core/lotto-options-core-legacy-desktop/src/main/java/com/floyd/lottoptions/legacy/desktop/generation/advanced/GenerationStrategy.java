package com.floyd.lottoptions.legacy.desktop.generation.advanced;

import java.util.Map;

/**
 * Represents a generation strategy with parameters and configuration.
 * Used by the Advanced Generation Engine to determine how to generate tickets.
 */
public class GenerationStrategy {
    
    private final String type;
    private final String description;
    private final Map<String, Object> parameters;
    
    public GenerationStrategy(String type, String description, Map<String, Object> parameters) {
        this.type = type;
        this.description = description;
        this.parameters = parameters;
    }
    
    /**
     * Gets the strategy type (e.g., "COMBINED_INTELLIGENCE", "DROUGHT_FOCUSED").
     */
    public String getType() {
        return type;
    }
    
    /**
     * Gets a human-readable description of the strategy.
     */
    public String getDescription() {
        return description;
    }
    
    /**
     * Gets the strategy parameters for configuration.
     */
    public Map<String, Object> getParameters() {
        return parameters;
    }
    
    /**
     * Gets a specific parameter value.
     */
    @SuppressWarnings("unchecked")
    public <T> T getParameter(String key, Class<T> type) {
        Object value = parameters.get(key);
        if (value != null && type.isInstance(value)) {
            return (T) value;
        }
        return null;
    }
    
    /**
     * Checks if the strategy has a specific parameter.
     */
    public boolean hasParameter(String key) {
        return parameters.containsKey(key);
    }
    
    /**
     * Gets the strategy complexity level.
     */
    public StrategyComplexity getComplexity() {
        switch (type) {
            case "COMBINED_INTELLIGENCE":
                return StrategyComplexity.VERY_HIGH;
            case "DROUGHT_FOCUSED":
            case "PATTERN_FOCUSED":
                return StrategyComplexity.HIGH;
            case "ENHANCED_RANDOM":
                return StrategyComplexity.MEDIUM;
            default:
                return StrategyComplexity.LOW;
        }
    }
    
    /**
     * Gets strategy effectiveness estimate (0.0 to 1.0).
     */
    public double getEstimatedEffectiveness() {
        switch (type) {
            case "COMBINED_INTELLIGENCE":
                return 0.95; // Highest effectiveness with both drought and pattern data
            case "DROUGHT_FOCUSED":
                return 0.80; // High effectiveness with drought targeting
            case "PATTERN_FOCUSED":
                return 0.75; // Good effectiveness with historical patterns
            case "ENHANCED_RANDOM":
                return 0.60; // Moderate effectiveness with constraints
            default:
                return 0.40; // Basic effectiveness
        }
    }
    
    @Override
    public String toString() {
        return String.format("GenerationStrategy{type='%s', complexity=%s, effectiveness=%.1f%%, description='%s'}", 
                           type, getComplexity(), getEstimatedEffectiveness() * 100, description);
    }
    
    /**
     * Enum for strategy complexity levels.
     */
    public enum StrategyComplexity {
        LOW,
        MEDIUM, 
        HIGH,
        VERY_HIGH
    }
}