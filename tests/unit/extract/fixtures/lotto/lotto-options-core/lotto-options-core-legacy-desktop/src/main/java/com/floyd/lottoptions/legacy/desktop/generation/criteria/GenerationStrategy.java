package com.floyd.lottoptions.legacy.desktop.generation.criteria;

/**
 * Enumeration of generation strategies that influence stopping criteria and ticket generation behavior.
 * Each strategy represents a different risk/reward profile for lottery ticket generation.
 */
public enum GenerationStrategy {
    
    /**
     * Conservative strategy - prioritizes high quality over quantity.
     * - Higher quality score thresholds
     * - Lower pattern coverage requirements
     * - More stringent stopping criteria
     * - Suitable for users who prefer safer, well-analyzed tickets
     */
    CONSERVATIVE("conservative", 1.2, 0.8),
    
    /**
     * Balanced strategy - moderate approach between quality and coverage.
     * - Standard quality score thresholds
     * - Balanced pattern coverage requirements
     * - Default stopping criteria from configuration
     * - Suitable for most users
     */
    BALANCED("balanced", 1.0, 1.0),
    
    /**
     * Aggressive strategy - prioritizes pattern coverage and volume.
     * - Lower quality score thresholds (acceptable trade-off)
     * - Higher pattern coverage requirements
     * - More permissive stopping criteria
     * - Suitable for users wanting maximum pattern exploration
     */
    AGGRESSIVE("aggressive", 0.8, 1.3),
    
    /**
     * Template Matrix strategy - uses template-based generation approach.
     * - Utilizes TemplateMatrix methodology
     * - Template group selection based on performance analysis
     * - Round robin distribution across selected templates
     * - Suitable for users wanting template-based pattern optimization
     */
    TEMPLATE_MATRIX("template_matrix", 1.0, 1.0);

    private final String name;
    private final double qualityMultiplier;
    private final double coverageMultiplier;

    /**
     * Constructs a GenerationStrategy with specified parameters.
     *
     * @param name The strategy name for configuration lookup
     * @param qualityMultiplier Multiplier for quality score thresholds
     * @param coverageMultiplier Multiplier for pattern coverage thresholds
     */
    GenerationStrategy(String name, double qualityMultiplier, double coverageMultiplier) {
        this.name = name;
        this.qualityMultiplier = qualityMultiplier;
        this.coverageMultiplier = coverageMultiplier;
    }

    /**
     * Gets the strategy name for configuration lookup.
     *
     * @return The strategy name
     */
    public String getName() {
        return name;
    }

    /**
     * Gets the quality score threshold multiplier.
     * Values > 1.0 increase quality requirements, < 1.0 decrease them.
     *
     * @return The quality multiplier
     */
    public double getQualityMultiplier() {
        return qualityMultiplier;
    }

    /**
     * Gets the pattern coverage threshold multiplier.
     * Values > 1.0 increase coverage requirements, < 1.0 decrease them.
     *
     * @return The coverage multiplier
     */
    public double getCoverageMultiplier() {
        return coverageMultiplier;
    }

    /**
     * Parses a string into a GenerationStrategy, with fallback to BALANCED.
     *
     * @param strategyName The strategy name to parse
     * @return The corresponding GenerationStrategy, or BALANCED if not found
     */
    public static GenerationStrategy fromString(String strategyName) {
        if (strategyName == null) {
            return BALANCED;
        }
        
        for (GenerationStrategy strategy : values()) {
            if (strategy.name.equalsIgnoreCase(strategyName.trim())) {
                return strategy;
            }
        }
        
        return BALANCED;
    }

    /**
     * Checks if this strategy emphasizes quality over coverage.
     *
     * @return true if quality-focused (conservative), false otherwise
     */
    public boolean isQualityFocused() {
        return qualityMultiplier > 1.0;
    }

    /**
     * Checks if this strategy emphasizes coverage over quality.
     *
     * @return true if coverage-focused (aggressive), false otherwise
     */
    public boolean isCoverageFocused() {
        return coverageMultiplier > 1.0;
    }

    @Override
    public String toString() {
        return name;
    }
}