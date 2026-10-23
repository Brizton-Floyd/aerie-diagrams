package com.floyd.lottoptions.legacy.desktop.generation.advanced;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Real-time generation monitoring and feedback system that tracks
 * generation progress, performance metrics, and provides adaptive
 * feedback loops for optimization during the generation process.
 */
public class RealTimeGenerationMonitor {
    
    // Monitoring state
    private final String sessionId;
    private final LocalDateTime startTime;
    private final Map<String, AtomicLong> counters;
    private final Map<String, Double> performanceMetrics;
    private final List<GenerationEvent> eventLog;
    private final AtomicInteger currentPhase;
    
    // Configuration
    private final int targetTicketCount;
    private final long feedbackIntervalMs;
    private final double qualityThreshold;
    
    // Feedback system
    private final List<FeedbackListener> listeners;
    private final AdaptiveFeedbackSystem feedbackSystem;
    
    public RealTimeGenerationMonitor(String sessionId, int targetTicketCount) {
        this.sessionId = sessionId;
        this.targetTicketCount = targetTicketCount;
        this.startTime = LocalDateTime.now();
        this.feedbackIntervalMs = 1000; // 1 second feedback intervals
        this.qualityThreshold = 0.75; // 75% quality threshold
        
        this.counters = new ConcurrentHashMap<>();
        this.performanceMetrics = new ConcurrentHashMap<>();
        this.eventLog = Collections.synchronizedList(new ArrayList<>());
        this.currentPhase = new AtomicInteger(0);
        
        this.listeners = Collections.synchronizedList(new ArrayList<>());
        this.feedbackSystem = new AdaptiveFeedbackSystem();
        
        initializeCounters();
        recordEvent("MONITOR_STARTED", "Real-time monitoring initialized for session " + sessionId);
    }
    
    /**
     * Records a generation attempt.
     */
    public void recordAttempt() {
        increment("total_attempts");
        updatePerformanceMetrics();
        
        if (shouldProvideFeedback()) {
            provideFeedback();
        }
    }
    
    /**
     * Records a successful ticket generation.
     */
    public void recordSuccess(int[] ticket, double qualityScore, double strategicScore) {
        increment("successful_generations");
        
        // Update quality metrics
        updateAverageMetric("average_quality", qualityScore);
        updateAverageMetric("average_strategic", strategicScore);
        
        recordEvent("TICKET_GENERATED", 
            String.format("Generated ticket with quality=%.3f, strategic=%.3f: %s", 
                qualityScore, strategicScore, Arrays.toString(ticket)));
        
        // Check for quality milestones
        if (qualityScore >= 0.9) {
            recordEvent("QUALITY_MILESTONE", "Exceptional quality ticket generated: " + qualityScore);
            feedbackSystem.recordHighQualityTicket();
        }
        
        notifyListeners(new GenerationProgress(
            getCounter("successful_generations"),
            targetTicketCount,
            qualityScore,
            strategicScore,
            calculateEstimatedTimeRemaining()
        ));
    }
    
    /**
     * Records a failed generation attempt.
     */
    public void recordFailure(String reason) {
        increment("failed_attempts");
        recordEvent("GENERATION_FAILURE", reason);
        
        feedbackSystem.recordFailure(reason);
        
        // Check for concerning failure rates
        long totalAttempts = getCounter("total_attempts");
        long failures = getCounter("failed_attempts");
        
        if (totalAttempts > 100 && (double) failures / totalAttempts > 0.5) {
            recordEvent("HIGH_FAILURE_RATE", 
                String.format("Failure rate %.1f%% exceeds threshold", 
                    (double) failures / totalAttempts * 100));
            
            feedbackSystem.suggestStrategyAdjustment("HIGH_FAILURE_RATE");
        }
    }
    
    /**
     * Records a duplicate ticket detection.
     */
    public void recordDuplicate(int[] ticket) {
        increment("duplicates_found");
        recordEvent("DUPLICATE_DETECTED", "Duplicate ticket: " + Arrays.toString(ticket));
        
        feedbackSystem.recordDuplicate();
        
        // Alert if duplicate rate is high
        long successful = getCounter("successful_generations");
        long duplicates = getCounter("duplicates_found");
        
        if (successful > 10 && (double) duplicates / successful > 0.3) {
            feedbackSystem.suggestStrategyAdjustment("HIGH_DUPLICATE_RATE");
        }
    }
    
    /**
     * Records strategy change during generation.
     */
    public void recordStrategyChange(String fromStrategy, String toStrategy, String reason) {
        recordEvent("STRATEGY_CHANGE", 
            String.format("Strategy changed from %s to %s: %s", fromStrategy, toStrategy, reason));
        
        feedbackSystem.recordStrategyChange(fromStrategy, toStrategy, reason);
    }
    
    /**
     * Records phase progression.
     */
    public void recordPhaseProgress(int phase, String description) {
        currentPhase.set(phase);
        recordEvent("PHASE_PROGRESS", String.format("Phase %d: %s", phase, description));
        
        notifyListeners(new PhaseProgress(phase, description, calculatePhaseProgress()));
    }
    
    /**
     * Records optimization activity.
     */
    public void recordOptimization(String type, int ticketsAffected, double improvementScore) {
        increment("optimizations_performed");
        
        recordEvent("OPTIMIZATION", 
            String.format("%s optimization: %d tickets, improvement=%.3f", 
                type, ticketsAffected, improvementScore));
        
        feedbackSystem.recordOptimization(type, improvementScore);
    }
    
    /**
     * Gets current generation statistics.
     */
    public GenerationStatistics getCurrentStatistics() {
        long totalAttempts = getCounter("total_attempts");
        long successful = getCounter("successful_generations");
        long failures = getCounter("failed_attempts");
        long duplicates = getCounter("duplicates_found");
        
        double successRate = totalAttempts > 0 ? (double) successful / totalAttempts : 0.0;
        double failureRate = totalAttempts > 0 ? (double) failures / totalAttempts : 0.0;
        double duplicateRate = successful > 0 ? (double) duplicates / successful : 0.0;
        
        double averageQuality = performanceMetrics.getOrDefault("average_quality", 0.0);
        double averageStrategic = performanceMetrics.getOrDefault("average_strategic", 0.0);
        
        long elapsedMs = java.time.Duration.between(startTime, LocalDateTime.now()).toMillis();
        double ticketsPerSecond = elapsedMs > 0 ? (double) successful * 1000 / elapsedMs : 0.0;
        
        return new GenerationStatistics(
            successful, totalAttempts, failures, duplicates,
            successRate, failureRate, duplicateRate,
            averageQuality, averageStrategic, ticketsPerSecond,
            elapsedMs, calculateEstimatedTimeRemaining()
        );
    }
    
    /**
     * Gets generation health assessment.
     */
    public GenerationHealth getGenerationHealth() {
        GenerationStatistics stats = getCurrentStatistics();
        List<String> concerns = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();
        
        // Analyze health metrics
        if (stats.getSuccessRate() < 0.3) {
            concerns.add("Low success rate: " + String.format("%.1f%%", stats.getSuccessRate() * 100));
            recommendations.add("Consider adjusting generation strategy or parameters");
        }
        
        if (stats.getDuplicateRate() > 0.25) {
            concerns.add("High duplicate rate: " + String.format("%.1f%%", stats.getDuplicateRate() * 100));
            recommendations.add("Increase randomization or use better uniqueness checking");
        }
        
        if (stats.getAverageQuality() < qualityThreshold) {
            concerns.add("Below quality threshold: " + String.format("%.3f", stats.getAverageQuality()));
            recommendations.add("Apply more rigorous quality filtering or optimization");
        }
        
        if (stats.getTicketsPerSecond() < 0.1 && stats.getElapsedTimeMs() > 30000) {
            concerns.add("Low generation rate: " + String.format("%.2f tickets/sec", stats.getTicketsPerSecond()));
            recommendations.add("Consider performance optimization or strategy simplification");
        }
        
        // Add adaptive feedback recommendations
        recommendations.addAll(feedbackSystem.getRecommendations());
        
        HealthStatus status;
        if (concerns.isEmpty()) {
            status = HealthStatus.HEALTHY;
        } else if (concerns.size() <= 2) {
            status = HealthStatus.WARNING;
        } else {
            status = HealthStatus.CRITICAL;
        }
        
        return new GenerationHealth(status, concerns, recommendations, stats);
    }
    
    /**
     * Adds a feedback listener.
     */
    public void addListener(FeedbackListener listener) {
        listeners.add(listener);
    }
    
    /**
     * Removes a feedback listener.
     */
    public void removeListener(FeedbackListener listener) {
        listeners.remove(listener);
    }
    
    /**
     * Gets recent events for debugging.
     */
    public List<GenerationEvent> getRecentEvents(int limit) {
        synchronized (eventLog) {
            int fromIndex = Math.max(0, eventLog.size() - limit);
            return new ArrayList<>(eventLog.subList(fromIndex, eventLog.size()));
        }
    }
    
    /**
     * Exports monitoring data for analysis.
     */
    public MonitoringExport exportData() {
        return new MonitoringExport(
            sessionId, startTime, LocalDateTime.now(),
            new HashMap<>(counters.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(
                    Map.Entry::getKey, 
                    e -> e.getValue().get()))),
            new HashMap<>(performanceMetrics),
            new ArrayList<>(eventLog),
            getCurrentStatistics(),
            getGenerationHealth()
        );
    }
    
    // Private helper methods
    
    private void initializeCounters() {
        counters.put("total_attempts", new AtomicLong(0));
        counters.put("successful_generations", new AtomicLong(0));
        counters.put("failed_attempts", new AtomicLong(0));
        counters.put("duplicates_found", new AtomicLong(0));
        counters.put("optimizations_performed", new AtomicLong(0));
        
        performanceMetrics.put("average_quality", 0.0);
        performanceMetrics.put("average_strategic", 0.0);
    }
    
    private void increment(String counter) {
        counters.computeIfAbsent(counter, k -> new AtomicLong(0)).incrementAndGet();
    }
    
    private long getCounter(String counter) {
        return counters.getOrDefault(counter, new AtomicLong(0)).get();
    }
    
    private void updateAverageMetric(String metricName, double newValue) {
        synchronized (performanceMetrics) {
            double currentAverage = performanceMetrics.getOrDefault(metricName, 0.0);
            long count = getCounter("successful_generations");
            
            double newAverage = ((currentAverage * (count - 1)) + newValue) / count;
            performanceMetrics.put(metricName, newAverage);
        }
    }
    
    private void updatePerformanceMetrics() {
        // Update derived metrics like rates, speeds, etc.
        long totalAttempts = getCounter("total_attempts");
        long successful = getCounter("successful_generations");
        
        if (totalAttempts > 0) {
            performanceMetrics.put("success_rate", (double) successful / totalAttempts);
        }
    }
    
    private boolean shouldProvideFeedback() {
        long lastFeedbackTime = performanceMetrics.getOrDefault("last_feedback_time", 0.0).longValue();
        long currentTime = System.currentTimeMillis();
        
        return (currentTime - lastFeedbackTime) >= feedbackIntervalMs;
    }
    
    private void provideFeedback() {
        performanceMetrics.put("last_feedback_time", (double) System.currentTimeMillis());
        
        GenerationStatistics stats = getCurrentStatistics();
        FeedbackUpdate update = new FeedbackUpdate(
            LocalDateTime.now(),
            stats,
            feedbackSystem.getAdaptiveSuggestions(),
            calculateProgressPercentage()
        );
        
        notifyListeners(update);
    }
    
    private void recordEvent(String type, String message) {
        GenerationEvent event = new GenerationEvent(
            LocalDateTime.now(), type, message, currentPhase.get());
        
        eventLog.add(event);
        
        // Keep event log from growing too large
        if (eventLog.size() > 1000) {
            synchronized (eventLog) {
                if (eventLog.size() > 1000) {
                    eventLog.subList(0, 500).clear();
                }
            }
        }
    }
    
    private void notifyListeners(Object update) {
        for (FeedbackListener listener : new ArrayList<>(listeners)) {
            try {
                listener.onUpdate(update);
            } catch (Exception e) {
                // Log error but don't let it affect monitoring
                recordEvent("LISTENER_ERROR", "Feedback listener error: " + e.getMessage());
            }
        }
    }
    
    private long calculateEstimatedTimeRemaining() {
        long successful = getCounter("successful_generations");
        if (successful == 0) return -1; // Cannot estimate
        
        long elapsedMs = java.time.Duration.between(startTime, LocalDateTime.now()).toMillis();
        double rate = (double) successful / elapsedMs; // tickets per ms
        
        int remaining = targetTicketCount - (int) successful;
        return remaining > 0 ? (long) (remaining / rate) : 0;
    }
    
    private double calculatePhaseProgress() {
        // Simplified phase progress calculation
        return Math.min(1.0, (double) getCounter("successful_generations") / targetTicketCount);
    }
    
    private double calculateProgressPercentage() {
        return Math.min(100.0, ((double) getCounter("successful_generations") / targetTicketCount) * 100);
    }
    
    // Supporting classes and interfaces
    
    public interface FeedbackListener {
        void onUpdate(Object update);
    }
    
    public enum HealthStatus {
        HEALTHY, WARNING, CRITICAL
    }
    
    // Data classes for monitoring updates and statistics...
    
    public static class GenerationEvent {
        private final LocalDateTime timestamp;
        private final String type;
        private final String message;
        private final int phase;
        
        public GenerationEvent(LocalDateTime timestamp, String type, String message, int phase) {
            this.timestamp = timestamp;
            this.type = type;
            this.message = message;
            this.phase = phase;
        }
        
        // Getters
        public LocalDateTime getTimestamp() { return timestamp; }
        public String getType() { return type; }
        public String getMessage() { return message; }
        public int getPhase() { return phase; }
        
        @Override
        public String toString() {
            return String.format("[%s] Phase %d - %s: %s", 
                timestamp.format(DateTimeFormatter.ISO_LOCAL_TIME), phase, type, message);
        }
    }
    
    public static class GenerationStatistics {
        private final long successfulTickets;
        private final long totalAttempts;
        private final long failedAttempts;
        private final long duplicates;
        private final double successRate;
        private final double failureRate;
        private final double duplicateRate;
        private final double averageQuality;
        private final double averageStrategic;
        private final double ticketsPerSecond;
        private final long elapsedTimeMs;
        private final long estimatedTimeRemainingMs;
        
        public GenerationStatistics(long successfulTickets, long totalAttempts, long failedAttempts,
                                  long duplicates, double successRate, double failureRate,
                                  double duplicateRate, double averageQuality, double averageStrategic,
                                  double ticketsPerSecond, long elapsedTimeMs, long estimatedTimeRemainingMs) {
            this.successfulTickets = successfulTickets;
            this.totalAttempts = totalAttempts;
            this.failedAttempts = failedAttempts;
            this.duplicates = duplicates;
            this.successRate = successRate;
            this.failureRate = failureRate;
            this.duplicateRate = duplicateRate;
            this.averageQuality = averageQuality;
            this.averageStrategic = averageStrategic;
            this.ticketsPerSecond = ticketsPerSecond;
            this.elapsedTimeMs = elapsedTimeMs;
            this.estimatedTimeRemainingMs = estimatedTimeRemainingMs;
        }
        
        // Getters
        public long getSuccessfulTickets() { return successfulTickets; }
        public long getTotalAttempts() { return totalAttempts; }
        public long getFailedAttempts() { return failedAttempts; }
        public long getDuplicates() { return duplicates; }
        public double getSuccessRate() { return successRate; }
        public double getFailureRate() { return failureRate; }
        public double getDuplicateRate() { return duplicateRate; }
        public double getAverageQuality() { return averageQuality; }
        public double getAverageStrategic() { return averageStrategic; }
        public double getTicketsPerSecond() { return ticketsPerSecond; }
        public long getElapsedTimeMs() { return elapsedTimeMs; }
        public long getEstimatedTimeRemainingMs() { return estimatedTimeRemainingMs; }
        
        public String getSummary() {
            return String.format("Generated: %d/%d (%.1f%%), Quality: %.3f, Rate: %.2f/sec",
                successfulTickets, successfulTickets + (long)(totalAttempts * (1 - successRate)),
                successRate * 100, averageQuality, ticketsPerSecond);
        }
    }
    
    public static class GenerationHealth {
        private final HealthStatus status;
        private final List<String> concerns;
        private final List<String> recommendations;
        private final GenerationStatistics statistics;
        
        public GenerationHealth(HealthStatus status, List<String> concerns,
                               List<String> recommendations, GenerationStatistics statistics) {
            this.status = status;
            this.concerns = concerns;
            this.recommendations = recommendations;
            this.statistics = statistics;
        }
        
        public HealthStatus getStatus() { return status; }
        public List<String> getConcerns() { return concerns; }
        public List<String> getRecommendations() { return recommendations; }
        public GenerationStatistics getStatistics() { return statistics; }
        
        public boolean isHealthy() { return status == HealthStatus.HEALTHY; }
    }
    
    public static class GenerationProgress {
        private final long currentCount;
        private final int targetCount;
        private final double lastQuality;
        private final double lastStrategic;
        private final long estimatedTimeRemainingMs;
        
        public GenerationProgress(long currentCount, int targetCount, double lastQuality,
                                double lastStrategic, long estimatedTimeRemainingMs) {
            this.currentCount = currentCount;
            this.targetCount = targetCount;
            this.lastQuality = lastQuality;
            this.lastStrategic = lastStrategic;
            this.estimatedTimeRemainingMs = estimatedTimeRemainingMs;
        }
        
        public long getCurrentCount() { return currentCount; }
        public int getTargetCount() { return targetCount; }
        public double getLastQuality() { return lastQuality; }
        public double getLastStrategic() { return lastStrategic; }
        public long getEstimatedTimeRemainingMs() { return estimatedTimeRemainingMs; }
        
        public double getProgressPercentage() {
            return Math.min(100.0, ((double) currentCount / targetCount) * 100);
        }
    }
    
    public static class PhaseProgress {
        private final int phase;
        private final String description;
        private final double progress;
        
        public PhaseProgress(int phase, String description, double progress) {
            this.phase = phase;
            this.description = description;
            this.progress = progress;
        }
        
        public int getPhase() { return phase; }
        public String getDescription() { return description; }
        public double getProgress() { return progress; }
    }
    
    public static class FeedbackUpdate {
        private final LocalDateTime timestamp;
        private final GenerationStatistics statistics;
        private final List<String> adaptiveSuggestions;
        private final double progressPercentage;
        
        public FeedbackUpdate(LocalDateTime timestamp, GenerationStatistics statistics,
                             List<String> adaptiveSuggestions, double progressPercentage) {
            this.timestamp = timestamp;
            this.statistics = statistics;
            this.adaptiveSuggestions = adaptiveSuggestions;
            this.progressPercentage = progressPercentage;
        }
        
        public LocalDateTime getTimestamp() { return timestamp; }
        public GenerationStatistics getStatistics() { return statistics; }
        public List<String> getAdaptiveSuggestions() { return adaptiveSuggestions; }
        public double getProgressPercentage() { return progressPercentage; }
    }
    
    public static class MonitoringExport {
        private final String sessionId;
        private final LocalDateTime startTime;
        private final LocalDateTime exportTime;
        private final Map<String, Long> counters;
        private final Map<String, Double> metrics;
        private final List<GenerationEvent> events;
        private final GenerationStatistics statistics;
        private final GenerationHealth health;
        
        public MonitoringExport(String sessionId, LocalDateTime startTime, LocalDateTime exportTime,
                               Map<String, Long> counters, Map<String, Double> metrics,
                               List<GenerationEvent> events, GenerationStatistics statistics,
                               GenerationHealth health) {
            this.sessionId = sessionId;
            this.startTime = startTime;
            this.exportTime = exportTime;
            this.counters = counters;
            this.metrics = metrics;
            this.events = events;
            this.statistics = statistics;
            this.health = health;
        }
        
        // Getters for all fields...
        public String getSessionId() { return sessionId; }
        public LocalDateTime getStartTime() { return startTime; }
        public LocalDateTime getExportTime() { return exportTime; }
        public Map<String, Long> getCounters() { return counters; }
        public Map<String, Double> getMetrics() { return metrics; }
        public List<GenerationEvent> getEvents() { return events; }
        public GenerationStatistics getStatistics() { return statistics; }
        public GenerationHealth getHealth() { return health; }
    }
    
    // Adaptive feedback system for intelligent recommendations
    private static class AdaptiveFeedbackSystem {
        private final List<String> recommendations;
        private final Map<String, Integer> failurePatterns;
        private int highQualityStreak;
        private int duplicateStreak;
        
        public AdaptiveFeedbackSystem() {
            this.recommendations = new ArrayList<>();
            this.failurePatterns = new HashMap<>();
            this.highQualityStreak = 0;
            this.duplicateStreak = 0;
        }
        
        public void recordHighQualityTicket() {
            highQualityStreak++;
            if (highQualityStreak >= 5) {
                recommendations.add("Excellent quality streak detected - current strategy is performing well");
            }
        }
        
        public void recordFailure(String reason) {
            failurePatterns.merge(reason, 1, Integer::sum);
            
            if (failurePatterns.get(reason) >= 10) {
                recommendations.add("Frequent failure pattern: " + reason + " - consider strategy adjustment");
            }
        }
        
        public void recordDuplicate() {
            duplicateStreak++;
            if (duplicateStreak >= 5) {
                recommendations.add("Duplicate streak detected - increase randomization diversity");
            }
        }
        
        public void recordStrategyChange(String from, String to, String reason) {
            recommendations.add("Strategy change from " + from + " to " + to + " may improve performance");
        }
        
        public void recordOptimization(String type, double improvement) {
            if (improvement > 0.1) {
                recommendations.add("Effective " + type + " optimization - consider applying more frequently");
            }
        }
        
        public void suggestStrategyAdjustment(String trigger) {
            switch (trigger) {
                case "HIGH_FAILURE_RATE":
                    recommendations.add("Consider switching to enhanced random strategy to reduce failures");
                    break;
                case "HIGH_DUPLICATE_RATE":
                    recommendations.add("Implement stronger uniqueness constraints or diversification");
                    break;
            }
        }
        
        public List<String> getRecommendations() {
            List<String> result = new ArrayList<>(recommendations);
            recommendations.clear(); // Clear after retrieving
            return result;
        }
        
        public List<String> getAdaptiveSuggestions() {
            return getRecommendations();
        }
    }
}