package com.floyd.lottoptions.legacy.desktop.generation.criteria;

/**
 * Data model representing all stopping criteria for lottery ticket generation.
 * Contains thresholds and limits that determine when the generation process should stop,
 * organized by priority (pattern thresholds > quality thresholds > meta conditions).
 */
public class StoppingCriteria {

    // Primary: Pattern-based stopping criteria
    private final double hotPatternCoverageThreshold;
    private final double warmPatternCoverageThreshold;
    private final double totalPatternCoverageThreshold;
    private final double patternDistributionBalance;

    // Secondary: Quality-based stopping criteria  
    private final double optimizationScoreThreshold;
    private final double coveragePercentageThreshold;
    private final double diversityScoreThreshold;
    private final String minimumQualityGrade;

    // Fallback: Meta conditions
    private final int maxAttempts;
    private final long timeoutMillis;
    private final int maxTicketsPerBatch;
    private final double budgetLimit;

    // Strategy and context
    private final GenerationStrategy strategy;
    private final String targetTier;
    private final int requestedTickets;

    /**
     * Constructs StoppingCriteria with all parameters.
     */
    public StoppingCriteria(double hotPatternCoverageThreshold, double warmPatternCoverageThreshold,
                           double totalPatternCoverageThreshold, double patternDistributionBalance,
                           double optimizationScoreThreshold, double coveragePercentageThreshold,
                           double diversityScoreThreshold, String minimumQualityGrade,
                           int maxAttempts, long timeoutMillis, int maxTicketsPerBatch,
                           double budgetLimit, GenerationStrategy strategy, String targetTier,
                           int requestedTickets) {
        this.hotPatternCoverageThreshold = hotPatternCoverageThreshold;
        this.warmPatternCoverageThreshold = warmPatternCoverageThreshold;
        this.totalPatternCoverageThreshold = totalPatternCoverageThreshold;
        this.patternDistributionBalance = patternDistributionBalance;
        this.optimizationScoreThreshold = optimizationScoreThreshold;
        this.coveragePercentageThreshold = coveragePercentageThreshold;
        this.diversityScoreThreshold = diversityScoreThreshold;
        this.minimumQualityGrade = minimumQualityGrade;
        this.maxAttempts = maxAttempts;
        this.timeoutMillis = timeoutMillis;
        this.maxTicketsPerBatch = maxTicketsPerBatch;
        this.budgetLimit = budgetLimit;
        this.strategy = strategy;
        this.targetTier = targetTier;
        this.requestedTickets = requestedTickets;
    }

    // Primary criteria getters
    public double getHotPatternCoverageThreshold() { return hotPatternCoverageThreshold; }
    public double getWarmPatternCoverageThreshold() { return warmPatternCoverageThreshold; }
    public double getTotalPatternCoverageThreshold() { return totalPatternCoverageThreshold; }
    public double getPatternDistributionBalance() { return patternDistributionBalance; }

    // Secondary criteria getters
    public double getOptimizationScoreThreshold() { return optimizationScoreThreshold; }
    public double getCoveragePercentageThreshold() { return coveragePercentageThreshold; }
    public double getDiversityScoreThreshold() { return diversityScoreThreshold; }
    public String getMinimumQualityGrade() { return minimumQualityGrade; }

    // Meta condition getters
    public int getMaxAttempts() { return maxAttempts; }
    public long getTimeoutMillis() { return timeoutMillis; }
    public int getMaxTicketsPerBatch() { return maxTicketsPerBatch; }
    public double getBudgetLimit() { return budgetLimit; }

    // Strategy and context getters
    public GenerationStrategy getStrategy() { return strategy; }
    public String getTargetTier() { return targetTier; }
    public int getRequestedTickets() { return requestedTickets; }

    /**
     * Checks if pattern criteria are met based on current metrics.
     *
     * @param hotCoverage Current hot pattern coverage percentage
     * @param warmCoverage Current warm pattern coverage percentage
     * @param totalCoverage Total pattern coverage percentage
     * @param balanceScore Pattern distribution balance score (0-100)
     * @return true if any primary pattern criteria are satisfied
     */
    public boolean arePatternCriteriaMet(double hotCoverage, double warmCoverage, 
                                        double totalCoverage, double balanceScore) {
        return hotCoverage >= hotPatternCoverageThreshold ||
               warmCoverage >= warmPatternCoverageThreshold ||
               totalCoverage >= totalPatternCoverageThreshold ||
               balanceScore >= patternDistributionBalance;
    }

    /**
     * Checks if quality criteria are met based on current metrics.
     *
     * @param optimizationScore Current optimization score (0-100)
     * @param coveragePercentage Current coverage percentage
     * @param diversityScore Current diversity score
     * @param qualityGrade Current quality grade (A-F)
     * @return true if quality criteria are satisfied
     */
    public boolean areQualityCriteriaMet(double optimizationScore, double coveragePercentage,
                                        double diversityScore, String qualityGrade) {
        boolean scoreThresholdMet = optimizationScore >= optimizationScoreThreshold;
        boolean coverageThresholdMet = coveragePercentage >= coveragePercentageThreshold;
        boolean diversityThresholdMet = diversityScore >= diversityScoreThreshold;
        boolean gradeThresholdMet = isQualityGradeSufficient(qualityGrade);

        return scoreThresholdMet && (coverageThresholdMet || diversityThresholdMet || gradeThresholdMet);
    }

    /**
     * Checks if meta conditions (fallback criteria) are met.
     *
     * @param currentAttempt Current generation attempt number
     * @param elapsedTimeMillis Time elapsed since generation started
     * @param currentBudgetUsed Current budget used
     * @return true if any meta condition is met
     */
    public boolean areMetaConditionsMet(int currentAttempt, long elapsedTimeMillis, double currentBudgetUsed) {
        return currentAttempt >= maxAttempts ||
               elapsedTimeMillis >= timeoutMillis ||
               currentBudgetUsed >= budgetLimit;
    }

    /**
     * Checks if the ticket count requirement is met.
     * This is the primary stopping condition - once we have enough tickets, we should stop.
     *
     * @param currentTicketCount Current number of generated tickets
     * @return true if we have generated enough tickets to satisfy the user's request
     */
    public boolean isTicketCountRequirementMet(int currentTicketCount) {
        return currentTicketCount >= requestedTickets;
    }

    /**
     * Determines if the given quality grade meets the minimum requirement.
     */
    private boolean isQualityGradeSufficient(String qualityGrade) {
        if (qualityGrade == null || minimumQualityGrade == null) {
            return false;
        }
        
        int currentGrade = gradeToNumber(qualityGrade);
        int minimumGrade = gradeToNumber(minimumQualityGrade);
        
        return currentGrade >= minimumGrade;
    }

    /**
     * Converts quality grade to numeric value for comparison (A=5, B=4, C=3, D=2, F=1).
     */
    private int gradeToNumber(String grade) {
        switch (grade.toUpperCase()) {
            case "A": return 5;
            case "B": return 4;
            case "C": return 3;
            case "D": return 2;
            case "F": return 1;
            default: return 0;
        }
    }

    /**
     * Creates a builder for StoppingCriteria.
     *
     * @return A new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for StoppingCriteria.
     * Note: requestedTickets represents the user's total ticket request,
     * while maxTicketsPerBatch is just a technical processing constraint.
     */
    public static class Builder {
        private double hotPatternCoverageThreshold = 85.0;
        private double warmPatternCoverageThreshold = 70.0;
        private double totalPatternCoverageThreshold = 75.0;
        private double patternDistributionBalance = 80.0;
        private double optimizationScoreThreshold = 70.0;
        private double coveragePercentageThreshold = 60.0;
        private double diversityScoreThreshold = 70.0;
        private String minimumQualityGrade = "C";
        private int maxAttempts = 50;
        private long timeoutMillis = 30000L;
        private int maxTicketsPerBatch = 10;
        private double budgetLimit = 100.0;
        private GenerationStrategy strategy = GenerationStrategy.BALANCED;
        private String targetTier = "tier_2";
        private int requestedTickets = 50;

        public Builder hotPatternCoverageThreshold(double threshold) { this.hotPatternCoverageThreshold = threshold; return this; }
        public Builder warmPatternCoverageThreshold(double threshold) { this.warmPatternCoverageThreshold = threshold; return this; }
        public Builder totalPatternCoverageThreshold(double threshold) { this.totalPatternCoverageThreshold = threshold; return this; }
        public Builder patternDistributionBalance(double balance) { this.patternDistributionBalance = balance; return this; }
        public Builder optimizationScoreThreshold(double threshold) { this.optimizationScoreThreshold = threshold; return this; }
        public Builder coveragePercentageThreshold(double threshold) { this.coveragePercentageThreshold = threshold; return this; }
        public Builder diversityScoreThreshold(double threshold) { this.diversityScoreThreshold = threshold; return this; }
        public Builder minimumQualityGrade(String grade) { this.minimumQualityGrade = grade; return this; }
        public Builder maxAttempts(int attempts) { this.maxAttempts = attempts; return this; }
        public Builder timeoutMillis(long timeout) { this.timeoutMillis = timeout; return this; }
        public Builder maxTicketsPerBatch(int max) { this.maxTicketsPerBatch = max; return this; }
        public Builder budgetLimit(double limit) { this.budgetLimit = limit; return this; }
        public Builder strategy(GenerationStrategy strategy) { this.strategy = strategy; return this; }
        public Builder targetTier(String tier) { this.targetTier = tier; return this; }
        public Builder requestedTickets(int tickets) { this.requestedTickets = tickets; return this; }

        public StoppingCriteria build() {
            return new StoppingCriteria(hotPatternCoverageThreshold, warmPatternCoverageThreshold,
                    totalPatternCoverageThreshold, patternDistributionBalance,
                    optimizationScoreThreshold, coveragePercentageThreshold, diversityScoreThreshold,
                    minimumQualityGrade, maxAttempts, timeoutMillis, maxTicketsPerBatch,
                    budgetLimit, strategy, targetTier, requestedTickets);
        }
    }

    @Override
    public String toString() {
        return String.format("StoppingCriteria{strategy=%s, tier=%s, hotThreshold=%.1f, qualityThreshold=%.1f, maxAttempts=%d}",
                strategy, targetTier, hotPatternCoverageThreshold, optimizationScoreThreshold, maxAttempts);
    }
}