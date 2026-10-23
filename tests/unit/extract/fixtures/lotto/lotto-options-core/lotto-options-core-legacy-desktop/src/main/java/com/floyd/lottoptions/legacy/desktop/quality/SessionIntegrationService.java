package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Service responsible for integrating quality evaluation results with user sessions.
 * Manages session creation, quality data persistence, and user preference tracking
 * through the Phase 1 persistence API.
 */
public class SessionIntegrationService {

    private final LotteryPersistenceClient persistenceClient;
    private final Map<String, Integer> sessionToTicketSetMap = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Constructs a SessionIntegrationService with API client dependency.
     *
     * @param persistenceClient Client for API communication
     */
    public SessionIntegrationService(LotteryPersistenceClient persistenceClient) {
        this.persistenceClient = persistenceClient;
    }

    /**
     * Creates and stores a user session with quality evaluation results.
     *
     * @param userRequest The user's targeting request parameters
     * @param tickets The generated lottery tickets
     * @param qualityMetrics The quality evaluation results
     * @return CompletableFuture containing the session ID
     */
    public CompletableFuture<String> createAndStoreSession(UserTargetingRequest userRequest, 
                                                          List<int[]> tickets, 
                                                          QualityMetrics qualityMetrics) {
        
        String sessionId = generateSessionId(userRequest.getUserId());
        
        Map<String, Object> sessionData = buildSessionPayload(
                sessionId, 
                userRequest, 
                tickets, 
                qualityMetrics
        );
        
        return persistenceClient.saveSession(sessionData)
                .thenCompose(sessionResult -> {
                    // After session is created, create the ticket set
                    Map<String, Object> qualityData = buildQualityData(qualityMetrics);
                    List<String> patternsUsed = extractPatternsUsed(qualityMetrics);
                    
                    return persistenceClient.createTicketSet(sessionId, qualityData, patternsUsed);
                })
                .thenApply(ticketSetId -> {
                    System.out.println("DEBUG: Session and ticket set created successfully. SessionId: " + sessionId + ", TicketSetId: " + ticketSetId);
                    
                    // Store the ticket set ID in a thread-local or session storage for later retrieval
                    storeTicketSetIdForSession(sessionId, ticketSetId);
                    
                    // Add a small delay to ensure database transaction is committed
                    try {
                        Thread.sleep(100); // 100ms delay
                        System.out.println("DEBUG: Added 100ms delay after ticket set creation to ensure transaction commit");
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    
                    return sessionId;
                });
    }

    /**
     * Updates an existing session with new quality evaluation results.
     *
     * @param sessionId The existing session ID
     * @param qualityMetrics Updated quality metrics
     * @param userRequest The original user request (needed for lotteryConfigId and targetTier)
     * @return CompletableFuture that completes when update is stored
     */
    public CompletableFuture<Void> updateSessionQuality(String sessionId, QualityMetrics qualityMetrics, UserTargetingRequest userRequest) {
        // Create a complete session update that matches the expected UserRequest structure
        Map<String, Object> updateData = new HashMap<>();
        updateData.put("sessionId", sessionId);
        
        // Include essential fields from the original request
        updateData.put("targetTier", userRequest.getTargetTier());
        updateData.put("numberOfTickets", userRequest.getNumberOfTickets());
        updateData.put("generationStrategy", mapToValidGenerationStrategy(userRequest.getGenerationStrategy()));
        updateData.put("budget", userRequest.getBudget());
        
        // Ensure we have a valid lotteryConfigId
        String configId = qualityMetrics.getLotteryConfigId();
        if (configId == null || configId.trim().isEmpty()) {
            configId = userRequest.getLotteryConfigId();
        }
        updateData.put("lotteryConfigId", configId);
        
        return persistenceClient.saveSession(updateData);
    }

    /**
     * Stores user preferences for future session generation.
     *
     * @param userId The user identifier
     * @param preferences User's lottery targeting preferences
     * @return CompletableFuture that completes when preferences are stored
     */
    public CompletableFuture<Void> storeUserPreferences(String userId, UserPreferences preferences) {
        Map<String, Object> preferenceData = new HashMap<>();
        preferenceData.put("userId", userId);
        preferenceData.put("preferences", buildPreferencesData(preferences));
        preferenceData.put("timestamp", LocalDateTime.now().toString());
        
        return persistenceClient.saveSession(preferenceData);
    }

    /**
     * Creates a session for quality evaluation tracking without full targeting request.
     *
     * @param lotteryConfigId The lottery game identifier
     * @param tickets The tickets to evaluate
     * @param qualityMetrics The quality evaluation results
     * @return CompletableFuture containing the session ID
     */
    public CompletableFuture<String> createQualityOnlySession(String lotteryConfigId, 
                                                            List<int[]> tickets, 
                                                            QualityMetrics qualityMetrics) {
        
        String sessionId = generateSessionId("quality-eval");
        
        Map<String, Object> sessionData = new HashMap<>();
        sessionData.put("sessionId", sessionId);
        sessionData.put("lotteryConfigId", lotteryConfigId);
        sessionData.put("numberOfTickets", tickets.size());
        sessionData.put("generationStrategy", "BALANCED");
        
        return persistenceClient.saveSession(sessionData)
                .thenApply(result -> sessionId);
    }

    /**
     * Retrieves session history for a user.
     *
     * @param userId The user identifier
     * @return CompletableFuture containing the user's session history
     */
    public CompletableFuture<List<Map<String, Object>>> getUserSessionHistory(String userId) {
        // This would require a new API endpoint to get user sessions
        // For now, return empty list as placeholder
        return CompletableFuture.completedFuture(List.of());
    }

    /**
     * Generates a unique session ID.
     *
     * @param userId The user identifier
     * @return A unique session ID
     */
    private String generateSessionId(String userId) {
        String timestamp = String.valueOf(System.currentTimeMillis());
        String uniqueId = UUID.randomUUID().toString().substring(0, 8);
        return String.format("%s-%s-%s", userId, timestamp, uniqueId);
    }

    /**
     * Builds the complete session payload for API storage.
     *
     * @param sessionId The session identifier
     * @param userRequest The user's targeting request
     * @param tickets The generated tickets
     * @param qualityMetrics The quality evaluation results
     * @return Map representing the session payload
     */
    private Map<String, Object> buildSessionPayload(String sessionId, 
                                                  UserTargetingRequest userRequest, 
                                                  List<int[]> tickets, 
                                                  QualityMetrics qualityMetrics) {
        
        Map<String, Object> payload = new HashMap<>();
        
        // Basic session information
        payload.put("sessionId", sessionId);
        payload.put("targetTier", userRequest.getTargetTier());
        payload.put("numberOfTickets", tickets.size());
        payload.put("generationStrategy", mapToValidGenerationStrategy(userRequest.getGenerationStrategy()));
        payload.put("budget", userRequest.getBudget());
        // Ensure we have a valid lotteryConfigId - use from request if metrics is null/empty
        String configId = qualityMetrics.getLotteryConfigId();
        if (configId == null || configId.trim().isEmpty()) {
            configId = userRequest.getLotteryConfigId();
        }
        payload.put("lotteryConfigId", configId);
        
        // User preferences only
        payload.put("preferences", buildPreferencesData(userRequest.getPreferences()));
        
        return payload;
    }

    /**
     * Builds quality data map from QualityMetrics.
     *
     * @param qualityMetrics The quality metrics to convert
     * @return Map containing quality data
     */
    private Map<String, Object> buildQualityData(QualityMetrics qualityMetrics) {
        Map<String, Object> qualityData = new HashMap<>();
        
        qualityData.put("qualityScore", qualityMetrics.getOptimizationScore());
        qualityData.put("qualityGrade", qualityMetrics.getQualityGrade());
        qualityData.put("patternDistribution", qualityMetrics.getPatternDistribution());
        qualityData.put("coveragePercentage", qualityMetrics.getCoveragePercentage());
        qualityData.put("consecutiveRate", qualityMetrics.getConsecutiveRate());
        qualityData.put("repeatRate", qualityMetrics.getRepeatRate());
        qualityData.put("uniquenessScore", qualityMetrics.getUniquenessScore());
        qualityData.put("overlapPercentage", qualityMetrics.getOverlapPercentage());
        qualityData.put("analysisTimestamp", qualityMetrics.getAnalysisTimestamp().toString());
        
        return qualityData;
    }

    /**
     * Builds preferences data map from UserPreferences.
     *
     * @param preferences The user preferences to convert
     * @return Map containing preferences data
     */
    private Map<String, Object> buildPreferencesData(UserPreferences preferences) {
        Map<String, Object> preferencesData = new HashMap<>();
        
        preferencesData.put("avoidConsecutive", preferences.isAvoidConsecutive());
        preferencesData.put("preferredNumbers", preferences.getPreferredNumbers());
        preferencesData.put("excludeNumbers", preferences.getExcludeNumbers());
        preferencesData.put("minHotPatterns", preferences.getMinHotPatterns());
        preferencesData.put("maxColdPatterns", preferences.getMaxColdPatterns());
        preferencesData.put("targetCoveragePercentage", preferences.getTargetCoveragePercentage());
        
        return preferencesData;
    }

    /**
     * Creates a summary session for batch quality evaluation.
     *
     * @param batchId Identifier for the batch evaluation
     * @param qualityResults List of quality metrics for multiple ticket sets
     * @return CompletableFuture containing the batch session ID
     */
    public CompletableFuture<String> createBatchQualitySession(String batchId, 
                                                             List<QualityMetrics> qualityResults) {
        
        String sessionId = generateSessionId("batch-" + batchId);
        
        // Calculate aggregate statistics
        double avgScore = qualityResults.stream()
                .mapToDouble(QualityMetrics::getOptimizationScore)
                .average()
                .orElse(0.0);
        
        int totalTickets = qualityResults.stream()
                .mapToInt(QualityMetrics::getTotalTicketsAnalyzed)
                .sum();
        
        Map<String, Object> batchData = new HashMap<>();
        batchData.put("sessionId", sessionId);
        batchData.put("numberOfTickets", totalTickets);
        batchData.put("generationStrategy", "BALANCED");
        
        return persistenceClient.saveSession(batchData)
                .thenApply(result -> sessionId);
    }

    /**
     * Checks if the session integration service is operational.
     *
     * @return CompletableFuture containing health status
     */
    public CompletableFuture<Boolean> isServiceHealthy() {
        return persistenceClient.isApiHealthy();
    }

    /**
     * Maps incoming generation strategy strings to valid enum values.
     *
     * @param strategy The generation strategy from the request
     * @return A valid generation strategy string
     */
    private String mapToValidGenerationStrategy(String strategy) {
        if (strategy == null) {
            return "BALANCED";
        }
        
        // Map common strategy names to valid enum values
        switch (strategy.toLowerCase()) {
            case "template_matrix":
                return "TEMPLATE_MATRIX";
            case "pattern_based":
                return "PATTERN_BASED";
            case "conservative":
                return "CONSERVATIVE";
            case "aggressive":
                return "AGGRESSIVE";
            case "balanced":
                return "BALANCED";
            default:
                return "BALANCED"; // Default fallback
        }
    }

    /**
     * Extracts patterns used from quality metrics for ticket set creation.
     *
     * @param qualityMetrics The quality metrics
     * @return List of pattern names used in generation
     */
    private List<String> extractPatternsUsed(QualityMetrics qualityMetrics) {
        List<String> patterns = new java.util.ArrayList<>();
        
        // Add patterns based on available quality metrics data
        if (qualityMetrics.getPatternDistribution() != null && !qualityMetrics.getPatternDistribution().isEmpty()) {
            patterns.addAll(qualityMetrics.getPatternDistribution().keySet());
        }
        
        // Add default pattern if none found
        if (patterns.isEmpty()) {
            patterns.add("TEMPLATE_MATRIX");
            patterns.add("STANDARD_PATTERN");
        }
        
        return patterns;
    }

    /**
     * Stores the ticket set ID for a session.
     *
     * @param sessionId The session ID
     * @param ticketSetId The ticket set ID
     */
    private void storeTicketSetIdForSession(String sessionId, Integer ticketSetId) {
        sessionToTicketSetMap.put(sessionId, ticketSetId);
    }

    /**
     * Retrieves the ticket set ID for a session.
     *
     * @param sessionId The session ID
     * @return The ticket set ID, or null if not found
     */
    public Integer getTicketSetIdForSession(String sessionId) {
        return sessionToTicketSetMap.get(sessionId);
    }
}