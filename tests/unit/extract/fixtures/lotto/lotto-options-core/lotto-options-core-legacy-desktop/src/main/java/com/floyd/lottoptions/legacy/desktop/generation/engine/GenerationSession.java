package com.floyd.lottoptions.legacy.desktop.generation.engine;

import com.floyd.lottoptions.legacy.desktop.generation.criteria.StoppingCriteria;
import com.floyd.lottoptions.legacy.desktop.quality.UserTargetingRequest;

import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Session state management for lottery ticket generation process.
 * Maintains thread-safe state for concurrent generation operations and progress tracking.
 */
public class GenerationSession {

    private final String sessionId;
    private final UserTargetingRequest originalRequest;
    private final StoppingCriteria stoppingCriteria;
    private final LocalDateTime createdAt;
    
    // Thread-safe state tracking
    private final AtomicReference<GenerationStatus> currentStatus;
    private final AtomicInteger attemptCount;
    private final AtomicInteger successfulBatches;
    private final AtomicInteger failedBatches;
    private final ConcurrentHashMap<String, Integer> strategyUsage;
    
    // Progress tracking
    private volatile double currentQualityScore = 0.0;
    private volatile double currentPatternCoverage = 0.0;
    private volatile double budgetUsed = 0.0;
    private volatile String lastError = null;
    private volatile LocalDateTime lastUpdateTime = LocalDateTime.now();
    
    // Final result storage
    private volatile GeneratedTicketSet finalResult = null;

    /**
     * Creates a new GenerationSession with initial parameters.
     *
     * @param sessionId Unique session identifier
     * @param originalRequest The user's original request
     * @param stoppingCriteria Calculated stopping criteria for this session
     */
    public GenerationSession(String sessionId, UserTargetingRequest originalRequest, 
                           StoppingCriteria stoppingCriteria) {
        this.sessionId = sessionId;
        this.originalRequest = originalRequest;
        this.stoppingCriteria = stoppingCriteria;
        this.createdAt = LocalDateTime.now();
        this.currentStatus = new AtomicReference<>(GenerationStatus.PENDING);
        this.attemptCount = new AtomicInteger(0);
        this.successfulBatches = new AtomicInteger(0);
        this.failedBatches = new AtomicInteger(0);
        this.strategyUsage = new ConcurrentHashMap<>();
    }

    /**
     * Gets the unique session identifier.
     *
     * @return Session ID
     */
    public String getSessionId() {
        return sessionId;
    }

    /**
     * Gets the original user request.
     *
     * @return User targeting request
     */
    public UserTargetingRequest getOriginalRequest() {
        return originalRequest;
    }

    /**
     * Gets the stopping criteria for this session.
     *
     * @return Stopping criteria
     */
    public StoppingCriteria getStoppingCriteria() {
        return stoppingCriteria;
    }

    /**
     * Gets the session creation timestamp.
     *
     * @return Creation time
     */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * Gets the current generation status (thread-safe).
     *
     * @return Current status
     */
    public GenerationStatus getCurrentStatus() {
        return currentStatus.get();
    }

    /**
     * Updates the generation status (thread-safe).
     *
     * @param status New status
     */
    public void updateStatus(GenerationStatus status) {
        currentStatus.set(status);
        lastUpdateTime = LocalDateTime.now();
    }

    /**
     * Gets the current attempt count (thread-safe).
     *
     * @return Current attempt number
     */
    public int getAttemptCount() {
        return attemptCount.get();
    }

    /**
     * Increments the attempt count and returns the new value (thread-safe).
     *
     * @return New attempt count
     */
    public int incrementAttemptCount() {
        lastUpdateTime = LocalDateTime.now();
        return attemptCount.incrementAndGet();
    }

    /**
     * Increments successful batch count (thread-safe).
     *
     * @return New successful batch count
     */
    public int incrementSuccessfulBatches() {
        lastUpdateTime = LocalDateTime.now();
        return successfulBatches.incrementAndGet();
    }

    /**
     * Increments failed batch count (thread-safe).
     *
     * @return New failed batch count
     */
    public int incrementFailedBatches() {
        lastUpdateTime = LocalDateTime.now();
        return failedBatches.incrementAndGet();
    }

    /**
     * Records usage of a generation strategy (thread-safe).
     *
     * @param strategy Strategy name
     */
    public void recordStrategyUsage(String strategy) {
        strategyUsage.merge(strategy, 1, Integer::sum);
        lastUpdateTime = LocalDateTime.now();
    }

    /**
     * Updates current quality and pattern metrics.
     *
     * @param qualityScore Current quality score (0-100)
     * @param patternCoverage Current pattern coverage percentage
     */
    public void updateMetrics(double qualityScore, double patternCoverage) {
        this.currentQualityScore = qualityScore;
        this.currentPatternCoverage = patternCoverage;
        this.lastUpdateTime = LocalDateTime.now();
    }

    /**
     * Updates budget usage.
     *
     * @param budgetUsed Amount of budget used so far
     */
    public void updateBudgetUsed(double budgetUsed) {
        this.budgetUsed = budgetUsed;
        this.lastUpdateTime = LocalDateTime.now();
    }

    /**
     * Records an error message.
     *
     * @param error Error message
     */
    public void recordError(String error) {
        this.lastError = error;
        this.lastUpdateTime = LocalDateTime.now();
    }

    /**
     * Gets current quality score.
     *
     * @return Quality score
     */
    public double getCurrentQualityScore() {
        return currentQualityScore;
    }

    /**
     * Gets current pattern coverage.
     *
     * @return Pattern coverage percentage
     */
    public double getCurrentPatternCoverage() {
        return currentPatternCoverage;
    }

    /**
     * Gets current budget usage.
     *
     * @return Budget used
     */
    public double getBudgetUsed() {
        return budgetUsed;
    }

    /**
     * Gets the last error message.
     *
     * @return Last error, or null if none
     */
    public String getLastError() {
        return lastError;
    }

    /**
     * Gets the last update timestamp.
     *
     * @return Last update time
     */
    public LocalDateTime getLastUpdateTime() {
        return lastUpdateTime;
    }

    /**
     * Gets successful batch count.
     *
     * @return Successful batches
     */
    public int getSuccessfulBatches() {
        return successfulBatches.get();
    }

    /**
     * Gets failed batch count.
     *
     * @return Failed batches
     */
    public int getFailedBatches() {
        return failedBatches.get();
    }

    /**
     * Gets strategy usage statistics.
     *
     * @return Map of strategy to usage count
     */
    public ConcurrentHashMap<String, Integer> getStrategyUsage() {
        return new ConcurrentHashMap<>(strategyUsage);
    }

    /**
     * Calculates elapsed time since session creation.
     *
     * @return Elapsed seconds
     */
    public long getElapsedTimeSeconds() {
        return java.time.Duration.between(createdAt, LocalDateTime.now()).getSeconds();
    }

    /**
     * Checks if stopping criteria are met based on current state.
     *
     * @return Stopping reason if criteria met, null otherwise
     */
    public String checkStoppingCriteria() {
        long elapsedMillis = getElapsedTimeSeconds() * 1000;
        
        // Check pattern criteria (primary)
        if (stoppingCriteria.arePatternCriteriaMet(
                currentPatternCoverage, 
                currentPatternCoverage * 0.8, // Estimate warm coverage
                currentPatternCoverage, 
                currentQualityScore)) {
            return "Pattern coverage criteria met";
        }
        
        // Check quality criteria (secondary)
        if (stoppingCriteria.areQualityCriteriaMet(
                currentQualityScore, 
                currentPatternCoverage, 
                currentQualityScore * 0.9, // Estimate diversity
                getGradeFromScore(currentQualityScore))) {
            return "Quality criteria met";
        }
        
        // Check meta conditions (fallback)
        if (stoppingCriteria.areMetaConditionsMet(
                attemptCount.get(), 
                elapsedMillis, 
                budgetUsed)) {
            return "Meta conditions met (timeout/attempts/budget)";
        }
        
        return null;
    }

    /**
     * Estimates grade from quality score for criteria checking.
     */
    private String getGradeFromScore(double score) {
        if (score >= 85) return "A";
        if (score >= 70) return "B";
        if (score >= 55) return "C";
        if (score >= 40) return "D";
        return "F";
    }

    /**
     * Creates a progress update object for SSE streaming.
     *
     * @return Progress update with current state
     */
    public ProgressUpdate createProgressUpdate() {
        return new ProgressUpdate(
                sessionId,
                currentStatus.get(),
                attemptCount.get(),
                currentQualityScore,
                currentPatternCoverage,
                successfulBatches.get(),
                failedBatches.get(),
                getElapsedTimeSeconds(),
                lastError
        );
    }

    /**
     * Stores the final generation result.
     *
     * @param result The completed generation result
     */
    public void setFinalResult(GeneratedTicketSet result) {
        this.finalResult = result;
        this.lastUpdateTime = LocalDateTime.now();
    }
    
    /**
     * Gets the final generation result if available.
     *
     * @return The final result, or null if not yet available
     */
    public GeneratedTicketSet getFinalResult() {
        return finalResult;
    }
    
    /**
     * Checks if this session has a completed result.
     *
     * @return true if final result is available
     */
    public boolean hasResult() {
        return finalResult != null;
    }
    
    /**
     * Creates a generation summary from the current session state.
     *
     * @return Generation summary
     */
    public GenerationSummary createSummary() {
        return GenerationSummary.builder()
                .totalAttempts(attemptCount.get())
                .successfulBatches(successfulBatches.get())
                .failedBatches(failedBatches.get())
                .startTime(createdAt)
                .endTime(LocalDateTime.now())
                .stoppingReason(checkStoppingCriteria())
                .stoppingCriteriaType(determineStoppingCriteriaType())
                .strategyUsageCount(getStrategyUsage())
                .finalQualityScore(currentQualityScore)
                .finalPatternCoverage(currentPatternCoverage)
                .budgetUsed(budgetUsed)
                .build();
    }

    /**
     * Determines the type of stopping criteria based on current state.
     */
    private String determineStoppingCriteriaType() {
        if (currentPatternCoverage >= stoppingCriteria.getHotPatternCoverageThreshold()) {
            return "pattern";
        }
        if (currentQualityScore >= stoppingCriteria.getOptimizationScoreThreshold()) {
            return "quality";
        }
        return "meta";
    }

    @Override
    public String toString() {
        return String.format("GenerationSession{id='%s', status=%s, attempts=%d, quality=%.1f}",
                sessionId, currentStatus.get(), attemptCount.get(), currentQualityScore);
    }
}