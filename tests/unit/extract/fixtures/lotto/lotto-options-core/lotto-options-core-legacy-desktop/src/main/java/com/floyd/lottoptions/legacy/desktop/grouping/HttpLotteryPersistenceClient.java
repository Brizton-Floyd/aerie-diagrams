package com.floyd.lottoptions.legacy.desktop.grouping;

import org.springframework.http.codec.json.JacksonJsonDecoder;
import org.springframework.http.codec.json.JacksonJsonEncoder;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * HTTP implementation of {@link LotteryPersistenceClient} that communicates with the
 * Phase 1 lottery targeting persistence API via {@link WebClient}.
 * Handles pattern group storage, retrieval, and session management.
 */
public class HttpLotteryPersistenceClient implements LotteryPersistenceClient {

    private final WebClient webClient;
    private final int maxRetryAttempts;
    private final Duration timeout;

    /**
     * Constructs the persistence client with configurable base URL and timeout settings.
     *
     * @param baseUrl Base URL for the persistence API
     * @param timeout Request timeout in milliseconds
     * @param maxRetryAttempts Maximum retry attempts for failed requests
     * @param jsonMapper Mapper for the client's JSON codecs, normally the application's
     *                   Boot-managed mapper (Spring's default codecs would build their own
     *                   mapper with plain Jackson 3 defaults)
     */
    public HttpLotteryPersistenceClient(String baseUrl, int timeout, int maxRetryAttempts, JsonMapper jsonMapper) {
        
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .codecs(configurer -> {
                    configurer.defaultCodecs().jacksonJsonDecoder(new JacksonJsonDecoder(jsonMapper));
                    configurer.defaultCodecs().jacksonJsonEncoder(new JacksonJsonEncoder(jsonMapper));
                })
                .build();
        this.timeout = Duration.ofMillis(timeout);
        this.maxRetryAttempts = maxRetryAttempts;
    }

    /**
     * Stores pattern group analysis results for a specific lottery configuration.
     *
     * @param patternGroupData The pattern group data to store
     * @return CompletableFuture that completes when the operation is done
     */
    @Override
    public CompletableFuture<Void> storePatternGroups(PatternGroupData patternGroupData) {
        Map<String, Object> payload = buildPatternGroupPayload(patternGroupData);
        
        return webClient.post()
                .uri("/api/v1/lottery-targeting/patterns/{configId}", patternGroupData.getLotteryConfigId())
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Void.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorResume(this::handleApiError)
                .toFuture();
    }

    /**
     * Retrieves stored pattern groups for a specific lottery configuration.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return CompletableFuture containing the pattern group data, or null if not found
     */
    @Override
    public CompletableFuture<PatternGroupData> getPatternGroups(String lotteryConfigId) {
        return webClient.get()
                .uri("/api/v1/lottery-targeting/patterns/{configId}", lotteryConfigId)
                .retrieve()
                .bodyToMono(Map.class)
                .map(m -> (Map<String, Object>) m)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .map(this::parsePatternGroupResponse)
                .onErrorResume(WebClientResponseException.NotFound.class, ex -> Mono.empty())
                .onErrorResume(this::handleApiError)
                .toFuture();
    }

    /**
     * Stores a user session with quality evaluation results.
     *
     * @param sessionData The session data to store
     * @return CompletableFuture that completes when the operation is done
     */
    @Override
    public CompletableFuture<Void> saveSession(Map<String, Object> sessionData) {
        // DEBUG: Log the session data being sent to identify 400 error cause
        System.out.println("DEBUG: Attempting to save session data:");
        sessionData.forEach((key, value) -> 
            System.out.println("  " + key + ": " + (value != null ? value.toString() : "null"))
        );
        
        return webClient.post()
                .uri("/api/v1/lottery-targeting/sessions")
                .bodyValue(sessionData)
                .retrieve()
                .bodyToMono(Void.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorResume(throwable -> {
                    if (throwable instanceof WebClientResponseException) {
                        WebClientResponseException webEx = (WebClientResponseException) throwable;
                        System.out.println("DEBUG: Session API returned " + webEx.getStatusCode() + 
                                         " with response body: " + webEx.getResponseBodyAsString());
                    }
                    return handleApiError(throwable);
                })
                .toFuture();
    }

    /**
     * Retrieves lottery configuration details.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return CompletableFuture containing the configuration data
     */
    public CompletableFuture<Map<String, Object>> getLotteryConfiguration(String lotteryConfigId) {
        return webClient.get()
                .uri("/api/v1/lottery-targeting/configurations/{configId}", lotteryConfigId)
                .retrieve()
                .bodyToMono(Map.class)
                .map(m -> (Map<String, Object>) m)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorResume(this::handleApiError)
                .toFuture();
    }

    /**
     * Builds the API payload for pattern group storage.
     *
     * @param patternGroupData The pattern group data
     * @return Map representing the API payload
     */
    private Map<String, Object> buildPatternGroupPayload(PatternGroupData patternGroupData) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("lotteryConfigId", patternGroupData.getLotteryConfigId());
        payload.put("totalAnalyzedDraws", patternGroupData.getTotalAnalyzedDraws());
        payload.put("lastAnalysisDate", patternGroupData.getLastAnalysisDate().toString());
        
        Map<String, Map<String, Object>> groups = new HashMap<>();
        
        for (Map.Entry<String, PatternGroup> entry : patternGroupData.getGroups().entrySet()) {
            PatternGroup group = entry.getValue();
            Map<String, Object> groupData = new HashMap<>();
            groupData.put("patterns", group.getPatterns());
            groupData.put("frequency", group.getFrequency());
            groupData.put("efficiencyMultiplier", group.getEfficiencyMultiplier());
            groupData.put("lastUpdated", group.getLastUpdated().toString());
            
            groups.put(entry.getKey(), groupData);
        }
        
        payload.put("groups", groups);
        return payload;
    }

    /**
     * Parses the API response into PatternGroupData.
     *
     * @param response The API response map
     * @return PatternGroupData object
     */
    @SuppressWarnings("unchecked")
    private PatternGroupData parsePatternGroupResponse(Map<String, Object> response) {
        String lotteryConfigId = (String) response.get("lotteryConfigId");
        int totalAnalyzedDraws = (Integer) response.get("totalAnalyzedDraws");
        
        Map<String, Object> groupsData = (Map<String, Object>) response.get("groups");
        Map<String, PatternGroup> groups = new HashMap<>();
        
        for (Map.Entry<String, Object> entry : groupsData.entrySet()) {
            Map<String, Object> groupData = (Map<String, Object>) entry.getValue();
            
            PatternGroup group = new PatternGroup(
                    (java.util.List<String>) groupData.get("patterns"),
                    (java.util.List<Integer>) groupData.get("frequency"),
                    ((Number) groupData.get("efficiencyMultiplier")).doubleValue()
            );
            
            groups.put(entry.getKey(), group);
        }
        
        return new PatternGroupData(lotteryConfigId, totalAnalyzedDraws, groups);
    }

    /**
     * Handles API errors with graceful degradation.
     *
     * @param throwable The error that occurred
     * @return Empty Mono for graceful degradation
     */
    private <T> Mono<T> handleApiError(Throwable throwable) {
        if (throwable instanceof WebClientResponseException.NotFound) {
            logWarning("API endpoint not found: " + throwable.getMessage());
        } else if (throwable instanceof WebClientResponseException.ServiceUnavailable) {
            logError("API service unavailable: " + throwable.getMessage(), throwable);
        } else if (throwable instanceof WebClientResponseException) {
            WebClientResponseException webEx = (WebClientResponseException) throwable;
            logError("API call failed with status " + webEx.getStatusCode() + ": " + webEx.getMessage(), throwable);
        } else if (throwable instanceof java.net.ConnectException) {
            logError("Cannot connect to API server: " + throwable.getMessage(), throwable);
        } else {
            logError("Unexpected API error: " + throwable.getMessage(), throwable);
        }
        
        // Return empty result for graceful degradation
        return Mono.empty();
    }
    
    /**
     * Logging methods (in production, replace with proper logging framework like SLF4J)
     */
    
    private void logInfo(String message) {
        System.out.println("[INFO] LotteryPersistenceClient: " + message);
    }
    
    private void logWarning(String message) {
        System.out.println("[WARN] LotteryPersistenceClient: " + message);
    }
    
    private void logError(String message, Throwable throwable) {
        System.err.println("[ERROR] LotteryPersistenceClient: " + message);
        if (throwable != null) {
            System.err.println("  Caused by: " + throwable.getClass().getSimpleName() + ": " + throwable.getMessage());
        }
    }
    
    /**
     * Fallback mock data methods
     */
    
    private PatternGroupData createMockPatternGroupDataWithFallback(String lotteryConfigId) {
        logInfo("Using fallback mock pattern group data for config: " + lotteryConfigId);
        return createMockPatternGroupData(lotteryConfigId);
    }
    
    private java.util.List<Integer> getMockHotNumbers() {
        return java.util.Arrays.asList(7, 12, 18, 23, 31, 35);
    }
    
    private java.util.List<int[]> getMockProvenCombinations() {
        return java.util.Arrays.asList(
            new int[]{7, 12, 18, 23, 31},
            new int[]{5, 15, 22, 28, 35},
            new int[]{3, 14, 19, 26, 33}
        );
    }

    /**
     * Synchronous method to retrieve pattern group data for a specific lottery configuration.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return PatternGroupData or null if not available
     */
    @Override
    public PatternGroupData getPatternGroupData(String lotteryConfigId) {
        try {
            // Try to get data from API synchronously with timeout
            PatternGroupData result = getPatternGroups(lotteryConfigId)
                .get(timeout.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            
            if (result != null) {
                logInfo("Successfully retrieved pattern group data from API for config: " + lotteryConfigId);
                return result;
            } else {
                logWarning("API returned null pattern group data, falling back to mock data");
                return createMockPatternGroupDataWithFallback(lotteryConfigId);
            }
            
        } catch (java.util.concurrent.TimeoutException e) {
            logError("API call timed out after " + timeout.toMillis() + "ms, falling back to mock data", e);
            return createMockPatternGroupDataWithFallback(lotteryConfigId);
        } catch (Exception e) {
            logError("Error fetching pattern group data from API, falling back to mock data", e);
            return createMockPatternGroupDataWithFallback(lotteryConfigId);
        }
    }

    /**
     * Retrieves hot numbers for a specific lottery configuration.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return List of hot numbers
     */
    @Override
    public java.util.List<Integer> getHotNumbers(String lotteryConfigId) {
        try {
            // Call API to get hot numbers
            CompletableFuture<java.util.List> future = webClient.get()
                .uri("/api/v1/lottery-targeting/hot-numbers/{configId}", lotteryConfigId)
                .retrieve()
                .bodyToMono(java.util.List.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorReturn(java.util.Collections.emptyList())
                .toFuture();

            @SuppressWarnings("unchecked")
            java.util.List<Integer> result = (java.util.List<Integer>) future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            
            if (result != null && !result.isEmpty()) {
                logInfo("Retrieved " + result.size() + " hot numbers from API for config: " + lotteryConfigId);
                return result;
            } else {
                logWarning("API returned empty hot numbers, using fallback data");
                return getMockHotNumbers();
            }
            
        } catch (Exception e) {
            logError("Error fetching hot numbers from API, using fallback data", e);
            return getMockHotNumbers();
        }
    }

    /**
     * Retrieves proven combinations for a specific lottery configuration.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return List of proven combinations (each combination is an int array)
     */
    @Override
    public java.util.List<int[]> getProvenCombinations(String lotteryConfigId) {
        try {
            // Call API to get proven combinations
            CompletableFuture<java.util.List> future = webClient.get()
                .uri("/api/v1/lottery-targeting/combinations/{configId}", lotteryConfigId)
                .retrieve()
                .bodyToMono(java.util.List.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorReturn(java.util.Collections.emptyList())
                .toFuture();

            @SuppressWarnings("unchecked")
            java.util.List<java.util.Map<String, Object>> apiResult = (java.util.List<java.util.Map<String, Object>>) future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            
            if (apiResult != null && !apiResult.isEmpty()) {
                // Convert List<Map> to List<int[]> by extracting combinationNumbers field
                java.util.List<int[]> result = apiResult.stream()
                    .map(provenCombination -> {
                        @SuppressWarnings("unchecked")
                        java.util.List<Integer> numbers = (java.util.List<Integer>) provenCombination.get("combinationNumbers");
                        return numbers != null ? numbers.stream().mapToInt(Integer::intValue).toArray() : new int[0];
                    })
                    .filter(array -> array.length > 0)
                    .collect(java.util.stream.Collectors.toList());
                
                logInfo("Retrieved " + result.size() + " proven combinations from API for config: " + lotteryConfigId);
                return result;
            } else {
                logWarning("API returned empty proven combinations, using fallback data");
                return getMockProvenCombinations();
            }
            
        } catch (Exception e) {
            logError("Error fetching proven combinations from API, using fallback data", e);
            return getMockProvenCombinations();
        }
    }

    /**
     * Creates mock pattern group data for development/testing.
     */
    private PatternGroupData createMockPatternGroupData() {
        return createMockPatternGroupData("default-config");
    }
    
    /**
     * Creates mock pattern group data with specific config ID.
     */
    private PatternGroupData createMockPatternGroupData(String lotteryConfigId) {
        java.util.Map<String, PatternGroup> groups = new HashMap<>();
        
        // Hot patterns - using comma-separated format like real API
        groups.put("hot", new PatternGroup(
            java.util.Arrays.asList("05,15,25,30,35", "02,12,22,27,32", "01,16,23,28,34"),
            java.util.Arrays.asList(15, 12, 10),
            1.8
        ));
        
        // Warm patterns  
        groups.put("warm", new PatternGroup(
            java.util.Arrays.asList("03,11,18,24,31", "06,14,20,29,33", "04,13,17,26,35"),
            java.util.Arrays.asList(8, 7, 6),
            1.4
        ));
        
        // Cold patterns
        groups.put("cold", new PatternGroup(
            java.util.Arrays.asList("01,02,03,04,05", "31,32,33,34,35", "10,11,12,13,14"),
            java.util.Arrays.asList(2, 1, 1),
            0.8
        ));
        
        return new PatternGroupData(lotteryConfigId, 500, groups);
    }

    /**
     * Publishes a proven winning combination to the persistence API.
     */
    @Override
    public CompletableFuture<Void> publishProvenCombination(int[] winningTicket, String lotteryConfigId, 
                                                            double qualityScore, String winningTier, int frequencyCount) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("lotteryConfigId", lotteryConfigId);
        payload.put("combinationNumbers", java.util.Arrays.stream(winningTicket).boxed().collect(java.util.stream.Collectors.toList()));
        payload.put("frequencyCount", frequencyCount);
        payload.put("lastDrawnDate", LocalDateTime.now().toLocalDate().toString());
        payload.put("winCount", 1);
        payload.put("tierPerformance", Map.of(winningTier, 1));
        payload.put("qualityScore", qualityScore);
        
        return webClient.post()
                .uri("/api/v1/lottery-targeting/combinations")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Void.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorResume(throwable -> {
                    logError("Failed to publish proven combination for config: " + lotteryConfigId, throwable);
                    return Mono.empty();
                })
                .toFuture();
    }
    
    /**
     * Updates hot numbers using batch endpoint.
     */
    @Override
    public CompletableFuture<Void> updateHotNumbers(String lotteryConfigId, List<Integer> hotNumbers) {
        List<Map<String, Object>> hotNumberPayloads = new java.util.ArrayList<>();
        
        for (int i = 0; i < hotNumbers.size(); i++) {
            Map<String, Object> hotNumberData = new HashMap<>();
            hotNumberData.put("patternGroupId", i + 1);
            hotNumberData.put("numberPattern", hotNumbers.get(i).toString());
            hotNumberData.put("frequencyCount", 45);
            hotNumberPayloads.add(hotNumberData);
        }
        
        return webClient.post()
                .uri("/api/v1/lottery-targeting/hot-numbers/batch")
                .bodyValue(hotNumberPayloads)
                .retrieve()
                .bodyToMono(Void.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorResume(throwable -> {
                    logError("Failed to update hot numbers for config: " + lotteryConfigId, throwable);
                    return Mono.empty();
                })
                .toFuture();
    }
    
    /**
     * Creates a user session in the persistence API.
     */
    @Override
    public CompletableFuture<Void> createUserSession(String sessionId, String lotteryConfigId, String targetTier, 
                                                    int numberOfTickets, String generationStrategy, double budget) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("sessionId", sessionId);
        payload.put("lotteryConfigId", lotteryConfigId);
        payload.put("targetTier", targetTier);
        payload.put("numberOfTickets", numberOfTickets);
        payload.put("generationStrategy", generationStrategy);
        payload.put("budget", budget);
        
        // Add additional fields that might be required by the API
        payload.put("status", "ACTIVE");
        payload.put("createdAt", LocalDateTime.now().toString());
        payload.put("userId", "system"); // Default user for system-generated sessions
        
        return webClient.post()
                .uri("/api/v1/lottery-targeting/sessions")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Void.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorResume(throwable -> {
                    logError("Failed to create user session: " + sessionId + " - Payload: " + payload, throwable);
                    if (throwable instanceof WebClientResponseException) {
                        WebClientResponseException webEx = (WebClientResponseException) throwable;
                        System.err.println("Session creation error - Status: " + webEx.getStatusCode() + 
                                         ", Response: " + webEx.getResponseBodyAsString());
                    }
                    return Mono.error(throwable); // Re-throw to propagate the error
                })
                .toFuture();
    }
    
    /**
     * Creates a ticket set and returns the generated ticket set ID.
     */
    @Override
    public CompletableFuture<Integer> createTicketSet(String sessionId, Map<String, Object> qualityMetrics, List<String> patternsUsed) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("sessionId", sessionId);
        payload.put("qualityMetrics", qualityMetrics);
        payload.put("patternsUsed", patternsUsed);
        
        Map<String, Object> expectedPerformance = new HashMap<>();
        // Use actual optimization score for confidence, normalized to 0-1 range
        double optimizationScore = qualityMetrics.containsKey("optimizationScore") ? 
            ((Number) qualityMetrics.get("optimizationScore")).doubleValue() : 0.0;
        double confidence = Math.max(0.1, Math.min(1.0, optimizationScore / 100.0));
        expectedPerformance.put("overallConfidence", confidence);
        
        // Set recommendation level based on actual quality grade
        String qualityGrade = qualityMetrics.containsKey("qualityGrade") ? 
            (String) qualityMetrics.get("qualityGrade") : "C";
        String recommendationLevel = getRecommendationLevel(qualityGrade);
        expectedPerformance.put("recommendationLevel", recommendationLevel);
        payload.put("expectedPerformance", expectedPerformance);
        
        return webClient.post()
                .uri("/api/v1/lottery-targeting/ticket-sets")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> responseMap = (Map<String, Object>) response;
                    System.out.println("DEBUG: Ticket set API response: " + responseMap);
                    
                    Object ticketSetId = responseMap.get("ticketSetId");
                    if (ticketSetId instanceof Number) {
                        int id = ((Number) ticketSetId).intValue();
                        System.out.println("DEBUG: Successfully extracted ticket set ID: " + id);
                        return id;
                    }
                    
                    System.out.println("DEBUG: No ticketSetId in response, using fallback");
                    return 1;
                })
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorResume(throwable -> {
                    System.out.println("DEBUG: Ticket set creation failed with error: " + throwable.getClass().getSimpleName());
                    System.out.println("DEBUG: Error message: " + throwable.getMessage());
                    if (throwable instanceof WebClientResponseException) {
                        WebClientResponseException webEx = (WebClientResponseException) throwable;
                        System.out.println("DEBUG: HTTP Status: " + webEx.getStatusCode());
                        System.out.println("DEBUG: Response body: " + webEx.getResponseBodyAsString());
                    }
                    return Mono.just(1);
                })
                .toFuture();
    }
    
    /**
     * Saves multiple tickets using the new batch tickets API.
     */
    @Override
    public CompletableFuture<Void> saveSuccessfulTicketsBatch(List<int[]> tickets, String lotteryConfigId, 
                                                              String patternUsed, double confidenceScore, int ticketSetId) {
        List<Map<String, Object>> batchPayload = new java.util.ArrayList<>();
        
        for (int[] ticket : tickets) {
            Map<String, Object> ticketData = new HashMap<>();
            ticketData.put("ticketId", generateTicketId(lotteryConfigId));
            ticketData.put("ticketSetId", ticketSetId);
            ticketData.put("numbers", java.util.Arrays.stream(ticket).boxed().collect(java.util.stream.Collectors.toList()));
            ticketData.put("patternUsed", patternUsed);
            ticketData.put("confidenceScore", confidenceScore);
            
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("generatedBy", "SYSTEM");
            metadata.put("algorithm", "PATTERN_BASED");
            metadata.put("timestamp", LocalDateTime.now().toString());
            ticketData.put("metadata", metadata);
            
            batchPayload.add(ticketData);
        }
        
        return webClient.post()
                .uri("/api/v1/lottery-targeting/tickets/batch")
                .bodyValue(batchPayload)
                .retrieve()
                .bodyToMono(Void.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorResume(throwable -> {
                    logError("Failed to save ticket batch for config: " + lotteryConfigId, throwable);
                    return Mono.empty();
                })
                .toFuture();
    }
    
    /**
     * Generates a unique ticket ID.
     */
    private String generateTicketId(String lotteryConfigId) {
        return "TKT-" + lotteryConfigId.toUpperCase().replaceAll("[^A-Z0-9]", "").substring(0, Math.min(3, lotteryConfigId.length())) + 
               "-" + String.format("%06d", new java.util.Random().nextInt(999999));
    }
    
    /**
     * Checks the health status of the persistence API.
     */
    @Override
    public CompletableFuture<Boolean> isApiHealthy() {
        return webClient.get()
                .uri("/health")
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(2))
                .map(response -> true)
                .onErrorReturn(false)
                .toFuture();
    }
    
    /**
     * Gets recent lottery draws for overdue analysis.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @param count Number of recent draws to retrieve
     * @return List of recent draws (each draw is an int array)
     */
    @Override
    public List<int[]> getRecentDraws(String lotteryConfigId, int count) {
        try {
            CompletableFuture<List> future = webClient.get()
                .uri("/api/v1/lottery-targeting/draws/{configId}?limit={count}", lotteryConfigId, count)
                .retrieve()
                .bodyToMono(List.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorReturn(java.util.Collections.emptyList())
                .toFuture();

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> apiResult = (List<Map<String, Object>>) future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            
            if (apiResult != null && !apiResult.isEmpty()) {
                return apiResult.stream()
                    .map(draw -> {
                        @SuppressWarnings("unchecked")
                        List<Integer> numbers = (List<Integer>) draw.get("numbers");
                        return numbers != null ? numbers.stream().mapToInt(Integer::intValue).toArray() : new int[0];
                    })
                    .filter(array -> array.length > 0)
                    .collect(java.util.stream.Collectors.toList());
            }
            
            return new ArrayList<>();
            
        } catch (Exception e) {
            logError("Error fetching recent draws from API", e);
            return new ArrayList<>();
        }
    }
    
    /**
     * Gets number frequencies for improvement calculation.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return Map of number to frequency percentage
     */
    @Override
    public Map<Integer, Double> getNumberFrequencies(String lotteryConfigId) {
        try {
            CompletableFuture<Map> future = webClient.get()
                .uri("/api/v1/lottery-targeting/frequencies/{configId}", lotteryConfigId)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(timeout)
                .retryWhen(Retry.fixedDelay(maxRetryAttempts, Duration.ofSeconds(1)))
                .onErrorReturn(new HashMap<>())
                .toFuture();

            @SuppressWarnings("unchecked")
            Map<String, Object> apiResult = (Map<String, Object>) future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            
            if (apiResult != null && !apiResult.isEmpty()) {
                Map<Integer, Double> frequencies = new HashMap<>();
                for (Map.Entry<String, Object> entry : apiResult.entrySet()) {
                    try {
                        Integer number = Integer.parseInt(entry.getKey());
                        Double frequency = ((Number) entry.getValue()).doubleValue();
                        frequencies.put(number, frequency);
                    } catch (Exception e) {
                        // Skip invalid entries
                    }
                }
                return frequencies;
            }
            
            return new HashMap<>();
            
        } catch (Exception e) {
            logError("Error fetching number frequencies from API", e);
            return new HashMap<>();
        }
    }
    
    /**
     * Gets all known patterns for overdue analysis.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return List of all pattern strings
     */
    @Override
    public List<String> getAllPatterns(String lotteryConfigId) {
        try {
            PatternGroupData patternData = getPatternGroupData(lotteryConfigId);
            
            if (patternData != null) {
                List<String> allPatterns = new ArrayList<>();
                
                patternData.getHotPatterns()
                    .ifPresent(group -> allPatterns.addAll(group.getPatterns()));
                patternData.getWarmPatterns()
                    .ifPresent(group -> allPatterns.addAll(group.getPatterns()));
                patternData.getColdPatterns()
                    .ifPresent(group -> allPatterns.addAll(group.getPatterns()));
                
                return allPatterns;
            }
            
            return new ArrayList<>();
            
        } catch (Exception e) {
            logError("Error fetching all patterns from API", e);
            return new ArrayList<>();
        }
    }
    

    /**
     * Maps quality grade to recommendation level.
     */
    private String getRecommendationLevel(String qualityGrade) {
        switch (qualityGrade) {
            case "A": return "EXCELLENT";
            case "B": return "HIGH";
            case "C": return "MEDIUM";
            case "D": return "LOW";
            case "F": return "POOR";
            default: return "MEDIUM";
        }
    }
}