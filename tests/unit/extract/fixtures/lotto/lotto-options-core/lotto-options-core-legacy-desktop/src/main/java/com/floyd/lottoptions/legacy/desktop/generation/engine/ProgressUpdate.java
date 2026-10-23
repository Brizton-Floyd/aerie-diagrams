package com.floyd.lottoptions.legacy.desktop.generation.engine;

/**
 * Progress update data model for real-time streaming via Server-Sent Events.
 * Contains current state information that will be sent to JavaFX UI for progress display.
 */
public class ProgressUpdate {

    private final String sessionId;
    private final GenerationStatus status;
    private final int currentAttempt;
    private final double qualityScore;
    private final double patternCoverage;
    private final int successfulBatches;
    private final int failedBatches;
    private final long elapsedTimeSeconds;
    private final String lastError;

    /**
     * Constructs a ProgressUpdate with current generation state.
     *
     * @param sessionId Session identifier
     * @param status Current generation status
     * @param currentAttempt Current attempt number
     * @param qualityScore Current quality score (0-100)
     * @param patternCoverage Current pattern coverage percentage
     * @param successfulBatches Number of successful batches so far
     * @param failedBatches Number of failed batches so far
     * @param elapsedTimeSeconds Time elapsed since generation started
     * @param lastError Last error message, if any
     */
    public ProgressUpdate(String sessionId, GenerationStatus status, int currentAttempt,
                         double qualityScore, double patternCoverage, int successfulBatches,
                         int failedBatches, long elapsedTimeSeconds, String lastError) {
        this.sessionId = sessionId;
        this.status = status;
        this.currentAttempt = currentAttempt;
        this.qualityScore = qualityScore;
        this.patternCoverage = patternCoverage;
        this.successfulBatches = successfulBatches;
        this.failedBatches = failedBatches;
        this.elapsedTimeSeconds = elapsedTimeSeconds;
        this.lastError = lastError;
    }

    /**
     * Gets the session identifier.
     *
     * @return Session ID
     */
    public String getSessionId() {
        return sessionId;
    }

    /**
     * Gets the current generation status.
     *
     * @return Generation status
     */
    public GenerationStatus getStatus() {
        return status;
    }

    /**
     * Gets the current attempt number.
     *
     * @return Attempt number
     */
    public int getCurrentAttempt() {
        return currentAttempt;
    }

    /**
     * Gets the current quality score.
     *
     * @return Quality score (0-100)
     */
    public double getQualityScore() {
        return qualityScore;
    }

    /**
     * Gets the current pattern coverage.
     *
     * @return Pattern coverage percentage
     */
    public double getPatternCoverage() {
        return patternCoverage;
    }

    /**
     * Gets the number of successful batches.
     *
     * @return Successful batch count
     */
    public int getSuccessfulBatches() {
        return successfulBatches;
    }

    /**
     * Gets the number of failed batches.
     *
     * @return Failed batch count
     */
    public int getFailedBatches() {
        return failedBatches;
    }

    /**
     * Gets the elapsed time in seconds.
     *
     * @return Elapsed time
     */
    public long getElapsedTimeSeconds() {
        return elapsedTimeSeconds;
    }

    /**
     * Gets the last error message.
     *
     * @return Error message, or null if no error
     */
    public String getLastError() {
        return lastError;
    }

    /**
     * Calculates total batch count.
     *
     * @return Total batches (successful + failed)
     */
    public int getTotalBatches() {
        return successfulBatches + failedBatches;
    }

    /**
     * Calculates success rate as percentage.
     *
     * @return Success rate (0-100)
     */
    public double getSuccessRate() {
        int total = getTotalBatches();
        return total > 0 ? (double) successfulBatches / total * 100.0 : 0.0;
    }

    /**
     * Gets a human-readable progress message for UI display.
     *
     * @return Progress message
     */
    public String getProgressMessage() {
        switch (status) {
            case PENDING:
                return "Initializing generation process...";
            case RUNNING:
                return String.format("Attempt %d - Quality: %.1f%%, Coverage: %.1f%%", 
                                   currentAttempt, qualityScore, patternCoverage);
            case COMPLETED:
                return String.format("Generation completed - Quality: %.1f%% in %ds", 
                                   qualityScore, elapsedTimeSeconds);
            case CRITERIA_MET:
                return String.format("Criteria satisfied - Quality: %.1f%%, Coverage: %.1f%%", 
                                   qualityScore, patternCoverage);
            case TIMEOUT:
                return String.format("Timeout reached after %d attempts in %ds", 
                                   currentAttempt, elapsedTimeSeconds);
            case FAILED:
                return String.format("Generation failed: %s", lastError != null ? lastError : "Unknown error");
            case CANCELLED:
                return "Generation cancelled by user";
            default:
                return "Unknown status";
        }
    }

    /**
     * Creates a JSON-like string representation for SSE streaming.
     *
     * @return JSON-formatted string
     */
    public String toJsonString() {
        return String.format(
            "{\"sessionId\":\"%s\",\"status\":\"%s\",\"attempt\":%d,\"qualityScore\":%.2f," +
            "\"patternCoverage\":%.2f,\"successfulBatches\":%d,\"failedBatches\":%d," +
            "\"elapsedTime\":%d,\"message\":\"%s\",\"error\":%s}",
            sessionId, status.getCode(), currentAttempt, qualityScore, patternCoverage,
            successfulBatches, failedBatches, elapsedTimeSeconds, getProgressMessage(),
            lastError != null ? "\"" + lastError + "\"" : "null"
        );
    }

    /**
     * Checks if this update indicates generation is still active.
     *
     * @return true if generation is ongoing
     */
    public boolean isActive() {
        return status.isActive();
    }

    /**
     * Checks if this update indicates generation has finished.
     *
     * @return true if generation is complete
     */
    public boolean isFinished() {
        return status.isFinished();
    }

    /**
     * Checks if this update indicates a successful generation.
     *
     * @return true if generation was successful
     */
    public boolean isSuccessful() {
        return status.isSuccessful();
    }

    @Override
    public String toString() {
        return String.format("ProgressUpdate{session='%s', status=%s, attempt=%d, quality=%.1f}",
                sessionId, status, currentAttempt, qualityScore);
    }
}