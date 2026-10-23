package com.floyd.lottoptions.legacy.desktop.generation.engine;

import com.floyd.lottoptions.legacy.desktop.util.NumberFormatter;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Summary information about a completed lottery ticket generation process.
 * Contains statistics, timing information, and details about why generation stopped.
 */
public class GenerationSummary {

    private final int totalAttempts;
    private final int successfulBatches;
    private final int failedBatches;
    private final LocalDateTime startTime;
    private final LocalDateTime endTime;
    private final String stoppingReason;
    private final String stoppingCriteriaType;
    private final Map<String, Integer> strategyUsageCount;
    private final double finalQualityScore;
    private final double finalPatternCoverage;
    private final double budgetUsed;

    /**
     * Constructs a GenerationSummary with all tracking information.
     */
    public GenerationSummary(int totalAttempts, int successfulBatches, int failedBatches,
                           LocalDateTime startTime, LocalDateTime endTime, String stoppingReason,
                           String stoppingCriteriaType, Map<String, Integer> strategyUsageCount,
                           double finalQualityScore, double finalPatternCoverage, double budgetUsed) {
        this.totalAttempts = totalAttempts;
        this.successfulBatches = successfulBatches;
        this.failedBatches = failedBatches;
        this.startTime = startTime;
        this.endTime = endTime;
        this.stoppingReason = stoppingReason;
        this.stoppingCriteriaType = stoppingCriteriaType;
        this.strategyUsageCount = strategyUsageCount;
        this.finalQualityScore = finalQualityScore;
        this.finalPatternCoverage = finalPatternCoverage;
        this.budgetUsed = budgetUsed;
    }

    /**
     * Gets the total number of generation attempts made.
     *
     * @return Total attempts count
     */
    public int getTotalAttempts() {
        return totalAttempts;
    }

    /**
     * Gets the number of successful batch generations.
     *
     * @return Successful batches count
     */
    public int getSuccessfulBatches() {
        return successfulBatches;
    }

    /**
     * Gets the number of failed batch generations.
     *
     * @return Failed batches count
     */
    public int getFailedBatches() {
        return failedBatches;
    }

    /**
     * Gets the generation start time.
     *
     * @return Start timestamp
     */
    public LocalDateTime getStartTime() {
        return startTime;
    }

    /**
     * Gets the generation end time.
     *
     * @return End timestamp
     */
    public LocalDateTime getEndTime() {
        return endTime;
    }

    /**
     * Gets the reason why generation stopped.
     *
     * @return Human-readable stopping reason
     */
    public String getStoppingReason() {
        return stoppingReason;
    }

    /**
     * Gets the type of stopping criteria that was met.
     *
     * @return Criteria type (pattern, quality, meta)
     */
    public String getStoppingCriteriaType() {
        return stoppingCriteriaType;
    }

    /**
     * Gets the usage count for each generation strategy employed.
     *
     * @return Map of strategy name to usage count
     */
    public Map<String, Integer> getStrategyUsageCount() {
        return strategyUsageCount;
    }

    /**
     * Gets the final quality score achieved.
     *
     * @return Final quality score (0-100)
     */
    public double getFinalQualityScore() {
        return NumberFormatter.formatToTwoDecimals(finalQualityScore);
    }

    /**
     * Gets the final pattern coverage achieved.
     *
     * @return Final pattern coverage percentage
     */
    public double getFinalPatternCoverage() {
        return NumberFormatter.formatToTwoDecimals(finalPatternCoverage);
    }

    /**
     * Gets the amount of budget used during generation.
     *
     * @return Budget used
     */
    public double getBudgetUsed() {
        return NumberFormatter.formatToTwoDecimals(budgetUsed);
    }

    /**
     * Calculates the elapsed time in seconds.
     *
     * @return Elapsed time in seconds
     */
    public double getElapsedTimeSeconds() {
        if (startTime == null || endTime == null) {
            return 0.0;
        }
        double elapsed = java.time.Duration.between(startTime, endTime).toMillis() / 1000.0;
        return NumberFormatter.formatToTwoDecimals(elapsed);
    }

    /**
     * Calculates the success rate of batch generations.
     *
     * @return Success rate as percentage (0-100)
     */
    public double getSuccessRate() {
        int totalBatches = successfulBatches + failedBatches;
        double rate = totalBatches > 0 ? (double) successfulBatches / totalBatches * 100.0 : 0.0;
        return NumberFormatter.formatToTwoDecimals(rate);
    }

    /**
     * Gets the average attempts per successful batch.
     *
     * @return Average attempts per success
     */
    public double getAverageAttemptsPerSuccess() {
        double average = successfulBatches > 0 ? (double) totalAttempts / successfulBatches : 0.0;
        return NumberFormatter.formatToTwoDecimals(average);
    }

    /**
     * Checks if generation was efficient (low attempts, high success rate).
     *
     * @return true if generation was efficient
     */
    public boolean wasEfficient() {
        return getSuccessRate() >= 70.0 && getAverageAttemptsPerSuccess() <= 5.0;
    }

    /**
     * Creates a performance summary string for logging/display.
     *
     * @return Performance summary
     */
    public String getPerformanceSummary() {
        return String.format("Attempts: %d, Success Rate: %.1f%%, Time: %.1fs, Final Quality: %.1f",
                totalAttempts, getSuccessRate(), getElapsedTimeSeconds(), finalQualityScore);
    }

    /**
     * Creates a builder for GenerationSummary.
     *
     * @return A new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for GenerationSummary.
     */
    public static class Builder {
        private int totalAttempts = 0;
        private int successfulBatches = 0;
        private int failedBatches = 0;
        private LocalDateTime startTime = LocalDateTime.now();
        private LocalDateTime endTime = LocalDateTime.now();
        private String stoppingReason = "Completed normally";
        private String stoppingCriteriaType = "quality";
        private Map<String, Integer> strategyUsageCount = Map.of();
        private double finalQualityScore = 0.0;
        private double finalPatternCoverage = 0.0;
        private double budgetUsed = 0.0;

        public Builder totalAttempts(int attempts) { this.totalAttempts = attempts; return this; }
        public Builder successfulBatches(int batches) { this.successfulBatches = batches; return this; }
        public Builder failedBatches(int batches) { this.failedBatches = batches; return this; }
        public Builder startTime(LocalDateTime time) { this.startTime = time; return this; }
        public Builder endTime(LocalDateTime time) { this.endTime = time; return this; }
        public Builder stoppingReason(String reason) { this.stoppingReason = reason; return this; }
        public Builder stoppingCriteriaType(String type) { this.stoppingCriteriaType = type; return this; }
        public Builder strategyUsageCount(Map<String, Integer> usage) { this.strategyUsageCount = usage; return this; }
        public Builder finalQualityScore(double score) { this.finalQualityScore = score; return this; }
        public Builder finalPatternCoverage(double coverage) { this.finalPatternCoverage = coverage; return this; }
        public Builder budgetUsed(double budget) { this.budgetUsed = budget; return this; }

        public GenerationSummary build() {
            return new GenerationSummary(totalAttempts, successfulBatches, failedBatches,
                    startTime, endTime, stoppingReason, stoppingCriteriaType,
                    strategyUsageCount, finalQualityScore, finalPatternCoverage, budgetUsed);
        }
    }

    @Override
    public String toString() {
        return String.format("GenerationSummary{attempts=%d, success=%.1f%%, time=%.1fs}",
                totalAttempts, getSuccessRate(), getElapsedTimeSeconds());
    }
}