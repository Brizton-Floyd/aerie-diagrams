package com.floyd.lottoptions.legacy.desktop.grouping;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Persistence seam for the lottery targeting persistence API.
 *
 * <p>Defines exactly the operations that analyzer components (generation engine,
 * quality evaluation, template matrix, overdue/drought analysis) consume. The
 * production implementation is {@link HttpLotteryPersistenceClient}; tests use
 * {@code MockLotteryPersistenceClient} or lightweight stubs.</p>
 */
public interface LotteryPersistenceClient {

    /**
     * Stores pattern group analysis results for a specific lottery configuration.
     *
     * @param patternGroupData The pattern group data to store
     * @return CompletableFuture that completes when the operation is done
     */
    CompletableFuture<Void> storePatternGroups(PatternGroupData patternGroupData);

    /**
     * Retrieves stored pattern groups for a specific lottery configuration.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return CompletableFuture containing the pattern group data, or null if not found
     */
    CompletableFuture<PatternGroupData> getPatternGroups(String lotteryConfigId);

    /**
     * Stores a user session with quality evaluation results.
     *
     * @param sessionData The session data to store
     * @return CompletableFuture that completes when the operation is done
     */
    CompletableFuture<Void> saveSession(Map<String, Object> sessionData);

    /**
     * Synchronously retrieves pattern group data for a specific lottery configuration.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return PatternGroupData or null if not available
     */
    PatternGroupData getPatternGroupData(String lotteryConfigId);

    /**
     * Retrieves hot numbers for a specific lottery configuration.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return List of hot numbers
     */
    List<Integer> getHotNumbers(String lotteryConfigId);

    /**
     * Retrieves proven combinations for a specific lottery configuration.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return List of proven combinations (each combination is an int array)
     */
    List<int[]> getProvenCombinations(String lotteryConfigId);

    /**
     * Publishes a proven winning combination to the persistence API.
     *
     * @param winningTicket The winning ticket numbers
     * @param lotteryConfigId The lottery configuration identifier
     * @param qualityScore Quality score of the combination
     * @param winningTier The tier the combination won
     * @param frequencyCount Frequency count for the combination
     * @return CompletableFuture that completes when the operation is done
     */
    CompletableFuture<Void> publishProvenCombination(int[] winningTicket, String lotteryConfigId,
                                                     double qualityScore, String winningTier, int frequencyCount);

    /**
     * Updates hot numbers using the batch endpoint.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @param hotNumbers The hot numbers to store
     * @return CompletableFuture that completes when the operation is done
     */
    CompletableFuture<Void> updateHotNumbers(String lotteryConfigId, List<Integer> hotNumbers);

    /**
     * Creates a user session in the persistence API.
     *
     * @param sessionId Unique session identifier
     * @param lotteryConfigId The lottery configuration identifier
     * @param targetTier The prize tier being targeted
     * @param numberOfTickets Number of tickets requested
     * @param generationStrategy Strategy used for generation
     * @param budget Session budget
     * @return CompletableFuture that completes when the operation is done
     */
    CompletableFuture<Void> createUserSession(String sessionId, String lotteryConfigId, String targetTier,
                                              int numberOfTickets, String generationStrategy, double budget);

    /**
     * Creates a ticket set and returns the generated ticket set ID.
     *
     * @param sessionId Session identifier the ticket set belongs to
     * @param qualityMetrics Quality metrics for the ticket set
     * @param patternsUsed Patterns used during generation
     * @return CompletableFuture containing the generated ticket set ID
     */
    CompletableFuture<Integer> createTicketSet(String sessionId, Map<String, Object> qualityMetrics, List<String> patternsUsed);

    /**
     * Saves multiple tickets using the batch tickets API.
     *
     * @param tickets Tickets to save
     * @param lotteryConfigId The lottery configuration identifier
     * @param patternUsed Pattern used for generation
     * @param confidenceScore Confidence score for the tickets
     * @param ticketSetId Ticket set the tickets belong to
     * @return CompletableFuture that completes when the operation is done
     */
    CompletableFuture<Void> saveSuccessfulTicketsBatch(List<int[]> tickets, String lotteryConfigId,
                                                       String patternUsed, double confidenceScore, int ticketSetId);

    /**
     * Checks the health status of the persistence API.
     *
     * @return CompletableFuture containing true when the API is healthy
     */
    CompletableFuture<Boolean> isApiHealthy();

    /**
     * Gets recent lottery draws for overdue analysis.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @param count Number of recent draws to retrieve
     * @return List of recent draws (each draw is an int array); empty when unavailable
     */
    List<int[]> getRecentDraws(String lotteryConfigId, int count);

    /**
     * Gets number frequencies for improvement calculation.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return Map of number to frequency percentage; empty when unavailable
     */
    Map<Integer, Double> getNumberFrequencies(String lotteryConfigId);

    /**
     * Gets all known patterns for overdue analysis.
     *
     * @param lotteryConfigId The lottery configuration identifier
     * @return List of all pattern strings; empty when unavailable
     */
    List<String> getAllPatterns(String lotteryConfigId);
}
