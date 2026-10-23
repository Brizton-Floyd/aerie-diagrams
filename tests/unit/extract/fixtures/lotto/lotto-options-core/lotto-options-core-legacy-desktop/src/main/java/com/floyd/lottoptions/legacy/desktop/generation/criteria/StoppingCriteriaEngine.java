package com.floyd.lottoptions.legacy.desktop.generation.criteria;

import com.floyd.lottoptions.legacy.desktop.quality.UserTargetingRequest;
import com.floyd.lottoptions.legacy.desktop.quality.UserPreferences;

/**
 * Engine responsible for calculating stopping criteria based on user request parameters.
 * Applies strategy-based adjustments and volume scaling to determine when ticket generation should stop.
 * Implements a tiered approach where different prize tiers have different quality and coverage requirements.
 */
public class StoppingCriteriaEngine {

    // Base configuration values (can be moved to application.yml)
    private static final double BASE_HOT_PATTERN_COVERAGE = 85.0;
    private static final double BASE_WARM_PATTERN_COVERAGE = 70.0;
    private static final double BASE_TOTAL_PATTERN_COVERAGE = 75.0;
    private static final double BASE_PATTERN_DISTRIBUTION_BALANCE = 80.0;
    
    private static final double BASE_OPTIMIZATION_SCORE = 70.0;
    private static final double BASE_COVERAGE_PERCENTAGE = 60.0;
    private static final double BASE_DIVERSITY_SCORE = 70.0;
    private static final String BASE_MINIMUM_QUALITY_GRADE = "C";
    
    private static final int BASE_MAX_ATTEMPTS = 50;
    private static final long BASE_TIMEOUT_MILLIS = 30000L;
    private static final int BASE_MAX_TICKETS_PER_BATCH = 10;

    /**
     * Main entry point for calculating stopping criteria based on user request.
     * Applies strategy adjustments, tier-specific requirements, and volume scaling.
     *
     * @param request The user's targeting request with preferences and constraints
     * @return Fully configured StoppingCriteria for the generation process
     */
    public StoppingCriteria calculateCriteria(UserTargetingRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("UserTargetingRequest cannot be null");
        }

        GenerationStrategy strategy = GenerationStrategy.fromString(request.getGenerationStrategy());
        String targetTier = request.getTargetTier();
        int numberOfTickets = request.getNumberOfTickets();
        double budget = request.getBudget();

        // Start with base criteria
        StoppingCriteria.Builder builder = StoppingCriteria.builder()
                .strategy(strategy)
                .targetTier(targetTier)
                .requestedTickets(numberOfTickets)
                .budgetLimit(budget);

        // Apply tier-specific adjustments
        applyTierAdjustments(builder, targetTier);

        // Apply strategy-based multipliers
        applyStrategyAdjustments(builder, strategy);

        // Apply volume-based scaling
        applyVolumeAdjustments(builder, numberOfTickets, budget);

        // Apply user preference overrides
        applyUserPreferences(builder, request);

        return builder.build();
    }

    /**
     * Applies tier-specific requirements to the criteria builder.
     * Different prize tiers have different quality and coverage expectations.
     */
    private void applyTierAdjustments(StoppingCriteria.Builder builder, String targetTier) {
        switch (targetTier.toLowerCase()) {
            case "jackpot":
                // Highest tier - most stringent requirements
                builder.hotPatternCoverageThreshold(BASE_HOT_PATTERN_COVERAGE * 1.1)
                       .optimizationScoreThreshold(BASE_OPTIMIZATION_SCORE * 1.2)
                       .minimumQualityGrade("B")
                       .maxAttempts(BASE_MAX_ATTEMPTS * 2)
                       .timeoutMillis(BASE_TIMEOUT_MILLIS * 3);
                break;
                
            case "tier_2":
                // Second tier - high but achievable requirements
                builder.hotPatternCoverageThreshold(BASE_HOT_PATTERN_COVERAGE)
                       .optimizationScoreThreshold(BASE_OPTIMIZATION_SCORE * 1.1)
                       .minimumQualityGrade("B")
                       .maxAttempts(BASE_MAX_ATTEMPTS)
                       .timeoutMillis(BASE_TIMEOUT_MILLIS * 2);
                break;
                
            case "tier_3":
                // Third tier - moderate requirements
                builder.hotPatternCoverageThreshold(BASE_HOT_PATTERN_COVERAGE * 0.9)
                       .optimizationScoreThreshold(BASE_OPTIMIZATION_SCORE)
                       .minimumQualityGrade("C")
                       .maxAttempts(BASE_MAX_ATTEMPTS)
                       .timeoutMillis(BASE_TIMEOUT_MILLIS);
                break;
                
            case "tier_4":
                // Fourth tier - more achievable requirements
                builder.hotPatternCoverageThreshold(BASE_HOT_PATTERN_COVERAGE * 0.8)
                       .optimizationScoreThreshold(BASE_OPTIMIZATION_SCORE * 0.9)
                       .minimumQualityGrade("C")
                       .maxAttempts((int) (BASE_MAX_ATTEMPTS * 0.8))
                       .timeoutMillis(BASE_TIMEOUT_MILLIS);
                break;
                
            default:
                // Default to tier_2 behavior
                builder.hotPatternCoverageThreshold(BASE_HOT_PATTERN_COVERAGE)
                       .optimizationScoreThreshold(BASE_OPTIMIZATION_SCORE)
                       .minimumQualityGrade(BASE_MINIMUM_QUALITY_GRADE)
                       .maxAttempts(BASE_MAX_ATTEMPTS)
                       .timeoutMillis(BASE_TIMEOUT_MILLIS);
        }
    }

    /**
     * Applies strategy-based multipliers to adjust criteria based on user's risk preference.
     */
    private void applyStrategyAdjustments(StoppingCriteria.Builder builder, GenerationStrategy strategy) {
        double qualityMultiplier = strategy.getQualityMultiplier();
        double coverageMultiplier = strategy.getCoverageMultiplier();

        // Apply multipliers to current thresholds
        builder.hotPatternCoverageThreshold(
                Math.min(95.0, builder.build().getHotPatternCoverageThreshold() * coverageMultiplier))
               .warmPatternCoverageThreshold(
                Math.min(90.0, BASE_WARM_PATTERN_COVERAGE * coverageMultiplier))
               .totalPatternCoverageThreshold(
                Math.min(90.0, BASE_TOTAL_PATTERN_COVERAGE * coverageMultiplier))
               .optimizationScoreThreshold(
                Math.min(95.0, builder.build().getOptimizationScoreThreshold() * qualityMultiplier))
               .coveragePercentageThreshold(
                Math.min(90.0, BASE_COVERAGE_PERCENTAGE * coverageMultiplier))
               .diversityScoreThreshold(
                Math.min(95.0, BASE_DIVERSITY_SCORE * qualityMultiplier));

        // Adjust attempt limits based on strategy
        if (strategy == GenerationStrategy.CONSERVATIVE) {
            builder.maxAttempts((int) (builder.build().getMaxAttempts() * 1.5));
        } else if (strategy == GenerationStrategy.AGGRESSIVE) {
            builder.maxAttempts((int) (builder.build().getMaxAttempts() * 0.7));
        }
    }

    /**
     * Applies volume-based scaling to account for larger ticket requests and budgets.
     */
    private void applyVolumeAdjustments(StoppingCriteria.Builder builder, int numberOfTickets, double budget) {
        // Scale batch size based on ticket volume
        int adjustedBatchSize = Math.min(25, Math.max(5, numberOfTickets / 3));
        builder.maxTicketsPerBatch(adjustedBatchSize);

        // Scale timeout based on volume (more tickets = more time allowed)
        long volumeMultiplier = Math.max(1, numberOfTickets / 10);
        builder.timeoutMillis(builder.build().getTimeoutMillis() * volumeMultiplier);

        // Scale max attempts based on budget (higher budget = more attempts allowed)
        if (budget > 50.0) {
            builder.maxAttempts((int) (builder.build().getMaxAttempts() * 1.3));
        } else if (budget < 20.0) {
            builder.maxAttempts((int) (builder.build().getMaxAttempts() * 0.8));
        }

        // For large ticket requests, slightly relax quality requirements to ensure completion
        if (numberOfTickets > 50) {
            builder.optimizationScoreThreshold(
                Math.max(50.0, builder.build().getOptimizationScoreThreshold() * 0.9));
        }
    }

    /**
     * Applies user preference overrides to the criteria.
     */
    private void applyUserPreferences(StoppingCriteria.Builder builder, UserTargetingRequest request) {
        if (request.getPreferences() == null) {
            return;
        }

        UserPreferences preferences = request.getPreferences();

        // Override quality score if user has preference
        if (preferences.getMinQualityScore() > 0) {
            builder.optimizationScoreThreshold(preferences.getMinQualityScore());
        }

        // Override coverage if user has preference
        if (preferences.getTargetCoveragePercentage() > 0) {
            builder.coveragePercentageThreshold(preferences.getTargetCoveragePercentage());
        }

        // Override hot pattern requirements if user prefers balanced approach
        if (preferences.isPreferBalancedDistribution()) {
            builder.patternDistributionBalance(85.0)
                   .hotPatternCoverageThreshold(
                    Math.min(builder.build().getHotPatternCoverageThreshold(), 80.0));
        }

        // Adjust for consecutive number avoidance (may require more attempts)
        if (preferences.isAvoidConsecutive()) {
            builder.maxAttempts((int) (builder.build().getMaxAttempts() * 1.2));
        }
    }

    /**
     * Creates default stopping criteria for quick generation scenarios.
     *
     * @return Default StoppingCriteria suitable for most use cases
     */
    public static StoppingCriteria createDefaultCriteria() {
        return StoppingCriteria.builder()
                .strategy(GenerationStrategy.BALANCED)
                .targetTier("tier_2")
                .requestedTickets(10)
                .budgetLimit(20.0)
                .build();
    }

    /**
     * Creates minimal stopping criteria for testing or quick analysis.
     *
     * @return Minimal StoppingCriteria with low thresholds
     */
    public static StoppingCriteria createMinimalCriteria() {
        return StoppingCriteria.builder()
                .hotPatternCoverageThreshold(50.0)
                .optimizationScoreThreshold(40.0)
                .maxAttempts(10)
                .timeoutMillis(5000L)
                .minimumQualityGrade("D")
                .build();
    }
}