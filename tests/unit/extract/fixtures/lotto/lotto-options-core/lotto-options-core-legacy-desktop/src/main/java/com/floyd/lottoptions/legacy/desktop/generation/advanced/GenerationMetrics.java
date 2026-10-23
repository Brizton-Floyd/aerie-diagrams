package com.floyd.lottoptions.legacy.desktop.generation.advanced;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Tracks metrics and performance data for the Advanced Generation Engine.
 * Provides real-time monitoring and feedback for generation optimization.
 */
public class GenerationMetrics {
    
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private int totalAttempts;
    private int successfulGenerations;
    private int duplicatesGenerated;
    private int failedAttempts;
    private int finalTicketCount;
    private String lastError;
    
    // Real-time tracking
    private long lastProgressUpdate;
    private int progressUpdateCount;
    
    public GenerationMetrics() {
        reset();
    }
    
    /**
     * Marks the start of generation.
     */
    public void startGeneration() {
        this.startTime = LocalDateTime.now();
        this.lastProgressUpdate = System.currentTimeMillis();
    }
    
    /**
     * Marks the completion of generation.
     */
    public void completeGeneration(int finalTicketCount) {
        this.endTime = LocalDateTime.now();
        this.finalTicketCount = finalTicketCount;
    }
    
    /**
     * Records a successful ticket generation.
     */
    public void recordSuccessfulGeneration() {
        this.totalAttempts++;
        this.successfulGenerations++;
        updateProgress();
    }
    
    /**
     * Records a duplicate ticket generation.
     */
    public void recordDuplicate() {
        this.totalAttempts++;
        this.duplicatesGenerated++;
        updateProgress();
    }
    
    /**
     * Records a failed generation attempt.
     */
    public void recordFailedAttempt() {
        this.totalAttempts++;
        this.failedAttempts++;
        updateProgress();
    }
    
    /**
     * Records an error during generation.
     */
    public void recordError(String error) {
        this.lastError = error;
    }
    
    /**
     * Updates progress tracking.
     */
    private void updateProgress() {
        long currentTime = System.currentTimeMillis();
        if (currentTime - lastProgressUpdate > 1000) { // Update every second
            lastProgressUpdate = currentTime;
            progressUpdateCount++;
        }
    }
    
    /**
     * Gets the success rate (0.0 to 1.0).
     */
    public double getSuccessRate() {
        return totalAttempts > 0 ? (double) successfulGenerations / totalAttempts : 0.0;
    }
    
    /**
     * Gets the duplicate rate (0.0 to 1.0).
     */
    public double getDuplicateRate() {
        return totalAttempts > 0 ? (double) duplicatesGenerated / totalAttempts : 0.0;
    }
    
    /**
     * Gets the failure rate (0.0 to 1.0).
     */
    public double getFailureRate() {
        return totalAttempts > 0 ? (double) failedAttempts / totalAttempts : 0.0;
    }
    
    /**
     * Gets the total generation time in milliseconds.
     */
    public long getGenerationTimeMs() {
        if (startTime == null) {
            return 0;
        }
        
        LocalDateTime end = endTime != null ? endTime : LocalDateTime.now();
        return ChronoUnit.MILLIS.between(startTime, end);
    }
    
    /**
     * Gets the generation rate (tickets per second).
     */
    public double getGenerationRate() {
        long timeMs = getGenerationTimeMs();
        if (timeMs > 0 && finalTicketCount > 0) {
            return (double) finalTicketCount / (timeMs / 1000.0);
        }
        return 0.0;
    }
    
    /**
     * Gets efficiency score (0.0 to 1.0) - higher is better.
     */
    public double getEfficiencyScore() {
        if (totalAttempts == 0) {
            return 0.0;
        }
        
        // Efficiency based on success rate and low failure rate
        double successWeight = getSuccessRate() * 0.6;
        double failureWeight = (1.0 - getFailureRate()) * 0.3;
        double duplicateWeight = (1.0 - getDuplicateRate()) * 0.1;
        
        return successWeight + failureWeight + duplicateWeight;
    }
    
    /**
     * Gets performance grade (A, B, C, D, F).
     */
    public String getPerformanceGrade() {
        double efficiency = getEfficiencyScore();
        
        if (efficiency >= 0.90) return "A";
        if (efficiency >= 0.80) return "B";  
        if (efficiency >= 0.70) return "C";
        if (efficiency >= 0.60) return "D";
        return "F";
    }
    
    /**
     * Checks if generation is performing well.
     */
    public boolean isPerformingWell() {
        return getSuccessRate() > 0.7 && getFailureRate() < 0.2 && getDuplicateRate() < 0.3;
    }
    
    /**
     * Gets a summary of generation performance.
     */
    public String getSummary() {
        return String.format(
            "Performance: %s (%.1f%% efficiency) | Success: %.1f%% | Failures: %.1f%% | Duplicates: %.1f%% | Rate: %.1f tickets/sec",
            getPerformanceGrade(),
            getEfficiencyScore() * 100,
            getSuccessRate() * 100,
            getFailureRate() * 100,
            getDuplicateRate() * 100,
            getGenerationRate()
        );
    }
    
    /**
     * Gets detailed metrics report.
     */
    public String getDetailedReport() {
        StringBuilder report = new StringBuilder();
        report.append("=== Advanced Generation Metrics ===\n");
        report.append(String.format("Total Attempts: %d\n", totalAttempts));
        report.append(String.format("Successful Generations: %d\n", successfulGenerations));
        report.append(String.format("Duplicates: %d\n", duplicatesGenerated));
        report.append(String.format("Failures: %d\n", failedAttempts));
        report.append(String.format("Final Ticket Count: %d\n", finalTicketCount));
        report.append(String.format("Generation Time: %d ms\n", getGenerationTimeMs()));
        report.append(String.format("Success Rate: %.2f%%\n", getSuccessRate() * 100));
        report.append(String.format("Duplicate Rate: %.2f%%\n", getDuplicateRate() * 100));
        report.append(String.format("Failure Rate: %.2f%%\n", getFailureRate() * 100));
        report.append(String.format("Generation Rate: %.2f tickets/sec\n", getGenerationRate()));
        report.append(String.format("Efficiency Score: %.2f%%\n", getEfficiencyScore() * 100));
        report.append(String.format("Performance Grade: %s\n", getPerformanceGrade()));
        
        if (lastError != null) {
            report.append(String.format("Last Error: %s\n", lastError));
        }
        
        return report.toString();
    }
    
    /**
     * Resets all metrics.
     */
    public void reset() {
        this.startTime = null;
        this.endTime = null;
        this.totalAttempts = 0;
        this.successfulGenerations = 0;
        this.duplicatesGenerated = 0;
        this.failedAttempts = 0;
        this.finalTicketCount = 0;
        this.lastError = null;
        this.lastProgressUpdate = 0;
        this.progressUpdateCount = 0;
    }
    
    // Getters
    public LocalDateTime getStartTime() { return startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public int getTotalAttempts() { return totalAttempts; }
    public int getSuccessfulGenerations() { return successfulGenerations; }
    public int getDuplicatesGenerated() { return duplicatesGenerated; }
    public int getFailedAttempts() { return failedAttempts; }
    public int getFinalTicketCount() { return finalTicketCount; }
    public String getLastError() { return lastError; }
    public int getProgressUpdateCount() { return progressUpdateCount; }
}