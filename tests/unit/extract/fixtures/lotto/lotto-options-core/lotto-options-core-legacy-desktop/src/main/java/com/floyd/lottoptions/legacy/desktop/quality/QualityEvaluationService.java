package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;
import com.floyd.lottoptions.legacy.desktop.grouping.PatternGroupData;
import com.floyd.lottoptions.legacy.desktop.grouping.PatternGroupingService;
import com.floyd.persistence.model.LotteryGame;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Service that orchestrates quality evaluation for lottery tickets.
 * Combines local pattern analysis with API-stored pattern classifications
 * to provide comprehensive quality metrics and scoring.
 */
public class QualityEvaluationService {

    private final PatternBasedQualityAnalyzer qualityAnalyzer;
    private final PatternGroupingService patternGroupingService;
    private final LotteryPersistenceClient persistenceClient;
    
    // Cache timeout and staleness settings
    private static final int API_TIMEOUT_SECONDS = 10;
    private static final int MAX_PATTERN_AGE_DAYS = 7;

    /**
     * Constructs a QualityEvaluationService with required dependencies.
     *
     * @param persistenceClient Client for API communication
     */
    public QualityEvaluationService(LotteryPersistenceClient persistenceClient) {
        this.qualityAnalyzer = new PatternBasedQualityAnalyzer();
        this.patternGroupingService = new PatternGroupingService();
        this.persistenceClient = persistenceClient;
    }

    /**
     * Evaluates the quality of lottery tickets with comprehensive analysis.
     *
     * @param tickets List of lottery tickets to analyze
     * @param lotteryGame The lottery game context with historical data
     * @param lotteryConfigId The lottery configuration ID
     * @return QualityMetrics containing comprehensive analysis results
     */
    public QualityMetrics evaluateTicketQuality(List<int[]> tickets, LotteryGame lotteryGame, String lotteryConfigId) {
        if (tickets == null || tickets.isEmpty()) {
            return createEmptyQualityMetrics(lotteryConfigId);
        }

        try {
            // Get or create pattern group data
            PatternGroupData patternGroupData = getOrCreatePatternGroups(lotteryGame, lotteryConfigId);
            
            // Calculate total possible numbers for coverage analysis
            int totalPossibleNumbers = lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1;
            
            // Perform quality analysis
            QualityMetrics metrics = qualityAnalyzer.analyzeTicketQuality(
                    tickets, 
                    patternGroupData, 
                    totalPossibleNumbers,
                    persistenceClient
            );
            
            return metrics;
            
        } catch (Exception e) {
            // Log error and return degraded metrics
            System.err.println("Quality evaluation failed: " + e.getMessage());
            return createDegradedQualityMetrics(tickets, lotteryGame.getFullName());
        }
    }

    /**
     * Evaluates quality for a single ticket.
     *
     * @param ticket The lottery ticket to analyze
     * @param lotteryGame The lottery game context
     * @param lotteryConfigId The lottery configuration ID
     * @return QualityMetrics for the single ticket
     */
    public QualityMetrics evaluateSingleTicket(int[] ticket, LotteryGame lotteryGame, String lotteryConfigId) {
        return evaluateTicketQuality(List.of(ticket), lotteryGame, lotteryConfigId);
    }

    /**
     * Gets stored pattern groups from API or creates them locally if not available/stale.
     *
     * @param lotteryGame The lottery game to analyze
     * @param lotteryConfigId The lottery configuration ID
     * @return PatternGroupData with HOT/WARM/COLD classifications
     */
    private PatternGroupData getOrCreatePatternGroups(LotteryGame lotteryGame, String lotteryConfigId) {
        try {
            // First, try to get existing pattern groups from API
            CompletableFuture<PatternGroupData> apiCall = persistenceClient.getPatternGroups(lotteryConfigId);
            PatternGroupData existingData = apiCall.get(API_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            
            // Check if data exists and is fresh
            if (existingData != null && !existingData.isStale(MAX_PATTERN_AGE_DAYS)) {
                return existingData;
            }
            
            // Data is stale or missing, perform fresh analysis
            PatternGroupData freshData = performFreshAnalysis(lotteryGame, lotteryConfigId);
            
            // Store the fresh analysis in API (fire and forget)
            persistenceClient.storePatternGroups(freshData);
            
            return freshData;
            
        } catch (TimeoutException | ExecutionException | InterruptedException e) {
            // API call failed, fall back to local analysis
            System.err.println("API call failed, performing local analysis: " + e.getMessage());
            return performFreshAnalysis(lotteryGame, lotteryConfigId);
        }
    }

    /**
     * Performs fresh pattern analysis on the lottery game.
     *
     * @param lotteryGame The lottery game to analyze
     * @param lotteryConfigId The lottery configuration ID
     * @return PatternGroupData with fresh analysis results
     */
    private PatternGroupData performFreshAnalysis(LotteryGame lotteryGame, String lotteryConfigId) {
        // Skip analysis for Pick 3/4 games
        if (!patternGroupingService.canAnalyzeGame(lotteryGame)) {
            return createEmptyPatternGroupData(lotteryConfigId);
        }
        
        return patternGroupingService.analyzeAndClassifyPatterns(lotteryGame, lotteryConfigId);
    }

    /**
     * Performs a quick quality check on tickets without full analysis.
     * @deprecated Use performQuickQualityCheck(List<int[]>, LotteryGame, String) instead
     *
     * @param tickets List of tickets to check
     * @param lotteryGame The lottery game context
     * @return A simplified quality score (0-100)
     */
    @Deprecated
    public double performQuickQualityCheck(List<int[]> tickets, LotteryGame lotteryGame) {
        return performQuickQualityCheck(tickets, lotteryGame, lotteryGame.getFullName());
    }

    /**
     * Performs a quick quality check on tickets without full analysis.
     *
     * @param tickets List of tickets to check
     * @param lotteryGame The lottery game context
     * @param lotteryConfigId The lottery configuration ID
     * @return A simplified quality score (0-100)
     */
    public double performQuickQualityCheck(List<int[]> tickets, LotteryGame lotteryGame, String lotteryConfigId) {
        if (tickets == null || tickets.isEmpty()) {
            return 0.0;
        }

        try {
            QualityMetrics metrics = evaluateTicketQuality(tickets, lotteryGame, lotteryConfigId);
            return metrics.getOptimizationScore();
        } catch (Exception e) {
            // Return neutral score on error
            return 50.0;
        }
    }

    /**
     * Checks if the lottery game is suitable for quality analysis.
     *
     * @param lotteryGame The lottery game to check
     * @return true if the game can be analyzed
     */
    public boolean canEvaluateGame(LotteryGame lotteryGame) {
        return patternGroupingService.canAnalyzeGame(lotteryGame);
    }

    /**
     * Gets the current health status of the quality evaluation service.
     *
     * @return true if all components are functioning properly
     */
    public boolean isServiceHealthy() {
        try {
            // Check API connectivity
            CompletableFuture<Boolean> healthCheck = persistenceClient.isApiHealthy();
            return healthCheck.get(3, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Service can operate in degraded mode without API
            return true;
        }
    }

    /**
     * Creates empty quality metrics for error cases.
     */
    private QualityMetrics createEmptyQualityMetrics(String lotteryConfigId) {
        ImprovementMetrics emptyImprovement = new ImprovementMetrics(0.0, 0.0, 0.0, false, "unknown");
        return new QualityMetrics(
                0.0, "F", 
                java.util.Map.of("HOT", 0.0, "WARM", 0.0, "COLD", 0.0),
                0.0, 0.0, 0.0, 0.0, 0.0, 0, lotteryConfigId, emptyImprovement
        );
    }

    /**
     * Creates degraded quality metrics when analysis partially fails.
     */
    private QualityMetrics createDegradedQualityMetrics(List<int[]> tickets, String lotteryConfigId) {
        // Provide basic metrics even if pattern analysis fails
        double basicCoverage = calculateBasicCoverage(tickets);
        double basicDiversity = calculateBasicDiversity(tickets);
        double degradedScore = (basicCoverage + basicDiversity) / 2.0;
        
        ImprovementMetrics degradedImprovement = new ImprovementMetrics(0.0, 0.0, 0.0, false, "unknown");
        return new QualityMetrics(
                degradedScore, degradedScore >= 50.0 ? "C" : "D",
                java.util.Map.of("HOT", 0.0, "WARM", 100.0, "COLD", 0.0),
                basicCoverage, 0.0, 0.0, basicDiversity, 0.0, tickets.size(), lotteryConfigId, degradedImprovement
        );
    }

    /**
     * Creates empty pattern group data for games that cannot be analyzed.
     */
    private PatternGroupData createEmptyPatternGroupData(String lotteryConfigId) {
        return new PatternGroupData(lotteryConfigId, 0, java.util.Map.of());
    }

    /**
     * Calculates basic coverage for degraded metrics.
     */
    private double calculateBasicCoverage(List<int[]> tickets) {
        java.util.Set<Integer> uniqueNumbers = new java.util.HashSet<>();
        for (int[] ticket : tickets) {
            for (int number : ticket) {
                uniqueNumbers.add(number);
            }
        }
        return Math.min(100.0, uniqueNumbers.size() * 2.0);  // Simple heuristic
    }

    /**
     * Calculates basic diversity for degraded metrics.
     */
    private double calculateBasicDiversity(List<int[]> tickets) {
        java.util.Set<String> uniqueTickets = new java.util.HashSet<>();
        for (int[] ticket : tickets) {
            java.util.Arrays.sort(ticket);
            uniqueTickets.add(java.util.Arrays.toString(ticket));
        }
        return tickets.size() > 0 ? (double) uniqueTickets.size() / tickets.size() * 100.0 : 0.0;
    }
}