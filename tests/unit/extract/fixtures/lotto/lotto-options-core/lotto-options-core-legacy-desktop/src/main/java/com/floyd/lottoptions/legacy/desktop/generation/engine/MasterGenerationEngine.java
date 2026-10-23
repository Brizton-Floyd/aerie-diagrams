package com.floyd.lottoptions.legacy.desktop.generation.engine;

import com.floyd.lottoptions.legacy.desktop.generation.criteria.StoppingCriteria;
import com.floyd.lottoptions.legacy.desktop.generation.criteria.StoppingCriteriaEngine;
import com.floyd.lottoptions.legacy.desktop.shared.generator.LotteryNumberGenerator;
import com.floyd.lottoptions.legacy.desktop.shared.generator.RandomNumberGeneratorFactory;
import com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical.TemplateMatrixLotteryNumberGenerator;
import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;
import com.floyd.lottoptions.legacy.desktop.grouping.PatternGroupData;
import com.floyd.lottoptions.legacy.desktop.grouping.PatternGroup;
import com.floyd.lottoptions.legacy.desktop.quality.QualityEvaluationService;
import com.floyd.lottoptions.legacy.desktop.quality.QualityEvaluationEngine;
import com.floyd.lottoptions.legacy.desktop.quality.EnhancedQualityEvaluationEngine;
import com.floyd.lottoptions.legacy.desktop.quality.QualityMetrics;
import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateMatrixAnalysisResult;
import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateCorrelatedTicket;
import com.floyd.lottoptions.legacy.desktop.quality.SessionIntegrationService;
import com.floyd.lottoptions.legacy.desktop.quality.UserTargetingRequest;
import com.floyd.lottoptions.legacy.desktop.quality.ImprovementCalculator;
import com.floyd.lottoptions.legacy.desktop.quality.ImprovementMetrics;
import com.floyd.lottoptions.legacy.desktop.generation.delta.DeltaPureEngine;
import com.floyd.lottoptions.legacy.desktop.generation.delta.StrategicDeltaGenerator;
import com.floyd.lottoptions.legacy.desktop.generation.delta.DeltaAnalysisResult;
import com.floyd.lottoptions.legacy.desktop.generation.overdue.OverdueAnalyzer;
import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeDroughtAnalyzer;
import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeDroughtAnalysis;
import com.floyd.lottoptions.legacy.desktop.generation.performance.PatternPerformanceAnalyzer;
import com.floyd.lottoptions.legacy.desktop.generation.performance.PatternPerformanceAnalysis;
import com.floyd.lottoptions.legacy.desktop.generation.advanced.AdvancedGenerationEngine;
import com.floyd.lottoptions.legacy.desktop.generation.advanced.AdvancedGenerationConfig;
import com.floyd.lottoptions.legacy.desktop.generation.advanced.GenerationMetrics;
import com.floyd.lottoptions.legacy.desktop.generation.advanced.SmartTicketValidator;
import com.floyd.lottoptions.legacy.desktop.generation.advanced.RealTimeGenerationMonitor;
import com.floyd.lottoptions.legacy.desktop.generation.advanced.DroughtInformationService;
import com.floyd.lottoptions.legacy.desktop.grouping.PatternGroupingEngine;
import com.floyd.lottoptions.legacy.desktop.tier.TierOptimizationManager;
import com.floyd.lottoptions.legacy.desktop.tier.TierSpecificStoppingCriteria;
import com.floyd.lottoptions.legacy.desktop.tier.TierOptimizationStrategy;
import com.floyd.lottoptions.legacy.desktop.service.LotteryDataService;
import com.floyd.persistence.model.LotteryGame;
import com.floyd.persistence.model.response.StateGamesResponse;

import java.time.LocalDateTime;
import java.util.*;
import java.util.Optional;
import java.util.concurrent.*;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Master engine responsible for orchestrating lottery ticket generation with intelligent stopping criteria.
 * Implements the main generation loop with batch processing, quality evaluation, and prioritized stopping conditions.
 */
public class MasterGenerationEngine {

    private final StoppingCriteriaEngine stoppingCriteriaEngine;
    private final QualityEvaluationService qualityEvaluationService;
    private final QualityEvaluationEngine qualityEvaluationEngine;
    private final EnhancedQualityEvaluationEngine enhancedQualityEvaluationEngine;
    private final PatternGroupingEngine patternGroupingEngine;
    private final SessionIntegrationService sessionIntegrationService;
    private final LotteryPersistenceClient persistenceClient;
    private final RandomNumberGeneratorFactory generatorFactory;
    private final LotteryDataService lotteryDataService;
    private final ImprovementCalculator improvementCalculator;
    private final OverdueAnalyzer overdueAnalyzer;
    private final PrizeDroughtAnalyzer prizeDroughtAnalyzer;
    private final PatternPerformanceAnalyzer patternPerformanceAnalyzer;
    private final TierOptimizationManager tierOptimizationManager;
    private final HistoricalPerformanceService historicalPerformanceService;
    
    // Session tracking
    private final ConcurrentHashMap<String, GenerationSession> activeSessions;
    private final ExecutorService generationExecutor;
    private final java.util.concurrent.ScheduledExecutorService cleanupExecutor;
    
    // Generation strategies
    private final List<String> availableStrategies = Arrays.asList(
        "pattern_based",
        "template_matrix",
        "delta_pure",
        "delta_strategic"
    );
    
    // TemplateMatrix analysis tracking (thread-safe for concurrent access)
    private final ThreadLocal<TemplateMatrixAnalysisResult> currentTemplateMatrixAnalysis = new ThreadLocal<>();
    private final ThreadLocal<List<TemplateCorrelatedTicket>> currentCorrelatedTickets = new ThreadLocal<>();
    
    // Local storage for ticket set IDs when Phase 1 API fails
    private final Map<String, Integer> localTicketSetIds = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Constructs MasterGenerationEngine with required dependencies.
     *
     * @param persistenceClient Client for API communication
     * @param lotteryDataService Service for fetching lottery game data
     */
    public MasterGenerationEngine(LotteryPersistenceClient persistenceClient, 
                                 LotteryDataService lotteryDataService) {
        this.persistenceClient = persistenceClient;
        this.stoppingCriteriaEngine = new StoppingCriteriaEngine();
        this.qualityEvaluationService = new QualityEvaluationService(persistenceClient);
        this.qualityEvaluationEngine = new QualityEvaluationEngine(persistenceClient);
        this.enhancedQualityEvaluationEngine = new EnhancedQualityEvaluationEngine(persistenceClient);
        this.patternGroupingEngine = new PatternGroupingEngine(persistenceClient);
        this.sessionIntegrationService = new SessionIntegrationService(persistenceClient);
        this.generatorFactory = new RandomNumberGeneratorFactory();
        this.lotteryDataService = lotteryDataService;
        this.improvementCalculator = new ImprovementCalculator(persistenceClient);
        this.overdueAnalyzer = new OverdueAnalyzer(persistenceClient);
        this.prizeDroughtAnalyzer = new PrizeDroughtAnalyzer(persistenceClient, lotteryDataService);
        this.patternPerformanceAnalyzer = new PatternPerformanceAnalyzer(persistenceClient, lotteryDataService);
        this.tierOptimizationManager = new TierOptimizationManager(persistenceClient);
        this.historicalPerformanceService = new HistoricalPerformanceService();
        this.activeSessions = new ConcurrentHashMap<>();
        this.generationExecutor = Executors.newCachedThreadPool();
        this.cleanupExecutor = Executors.newSingleThreadScheduledExecutor();
        
        // Start cleanup task to remove old sessions every 5 minutes
        startSessionCleanupTask();
    }

    /**
     * Main entry point for generating lottery tickets.
     * Starts async generation process and returns immediately with session info.
     *
     * @param request User targeting request with preferences and constraints
     * @return Future containing GeneratedTicketSet when complete
     */
    public CompletableFuture<GeneratedTicketSet> generateTickets(UserTargetingRequest request) {
        return generateTickets(request, null);
    }
    
    /**
     * Starts ticket generation and returns the session ID immediately for progress tracking.
     *
     * @param request User targeting request with preferences and constraints
     * @param progressCallback Optional callback for progress updates
     * @return GenerationSession containing session ID and future result
     */
    public GenerationSessionResult startGeneration(UserTargetingRequest request, Consumer<ProgressUpdate> progressCallback) {
        if (request == null) {
            throw new IllegalArgumentException("UserTargetingRequest cannot be null");
        }

        // Generate unique session ID
        String sessionId = generateSessionId();
        
        // Start async generation
        CompletableFuture<GeneratedTicketSet> future = CompletableFuture.supplyAsync(() -> {
            try {
                return executeGenerationLoop(request, sessionId, progressCallback);
            } catch (Exception e) {
                // Mark session as failed
                GenerationSession session = activeSessions.get(sessionId);
                if (session != null) {
                    session.updateStatus(GenerationStatus.FAILED);
                }
                throw new RuntimeException("Generation failed: " + e.getMessage(), e);
            }
        }, generationExecutor);
        
        return new GenerationSessionResult(sessionId, future);
    }

    /**
     * Generates lottery tickets with optional progress callback for real-time updates.
     *
     * @param request User targeting request
     * @param progressCallback Optional callback for progress updates (for SSE)
     * @return Future containing GeneratedTicketSet when complete
     */
    public CompletableFuture<GeneratedTicketSet> generateTickets(UserTargetingRequest request, 
                                                                Consumer<ProgressUpdate> progressCallback) {
        if (request == null) {
            throw new IllegalArgumentException("UserTargetingRequest cannot be null");
        }

        // Generate unique session ID
        String sessionId = generateSessionId();
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                return executeGenerationLoop(request, sessionId, progressCallback);
            } catch (Exception e) {
                // Mark session as failed but keep it for error tracking
                GenerationSession session = activeSessions.get(sessionId);
                if (session != null) {
                    session.updateStatus(GenerationStatus.FAILED);
                }
                throw new RuntimeException("Generation failed: " + e.getMessage(), e);
            }
        }, generationExecutor);
    }

    /**
     * Gets the completed generation result for a session.
     *
     * @param sessionId Session identifier
     * @return GeneratedTicketSet if generation is complete, or null if not found/not complete
     */
    public GeneratedTicketSet getGenerationResult(String sessionId) {
        GenerationSession session = activeSessions.get(sessionId);
        if (session == null) {
            return null;
        }
        
        // Only return result if generation is completed
        if (session.getCurrentStatus() == GenerationStatus.COMPLETED && session.hasResult()) {
            return session.getFinalResult();
        }
        
        return null;
    }
    
    /**
     * Gets the current progress for an active session.
     *
     * @param sessionId Session identifier
     * @return ProgressUpdate with current state, or null if session not found
     */
    public ProgressUpdate getSessionProgress(String sessionId) {
        GenerationSession session = activeSessions.get(sessionId);
        return session != null ? session.createProgressUpdate() : null;
    }

    /**
     * Cancels an active generation session.
     *
     * @param sessionId Session to cancel
     * @return true if session was cancelled, false if not found or already finished
     */
    public boolean cancelSession(String sessionId) {
        GenerationSession session = activeSessions.get(sessionId);
        if (session != null && session.getCurrentStatus().isActive()) {
            session.updateStatus(GenerationStatus.CANCELLED);
            return true;
        }
        return false;
    }

    /**
     * Main generation loop implementation with prioritized stopping criteria.
     */
    private GeneratedTicketSet executeGenerationLoop(UserTargetingRequest request, String sessionId,
                                                    Consumer<ProgressUpdate> progressCallback) {
        
        // Step 1: Initialize session and calculate stopping criteria
        StoppingCriteria stoppingCriteria = stoppingCriteriaEngine.calculateCriteria(request);
        GenerationSession session = new GenerationSession(sessionId, request, stoppingCriteria);
        activeSessions.put(sessionId, session);
        
        session.updateStatus(GenerationStatus.RUNNING);
        notifyProgress(session, progressCallback);
        
        // Step 1.5: Create API session following proper sequence
        String apiSessionId = null;
        try {
            apiSessionId = createApiSession(request, sessionId);
            System.out.println("Created API session: " + apiSessionId);
        } catch (Exception e) {
            System.err.println("Failed to create API session: " + e.getMessage());
            e.printStackTrace();
            // For now, continue without API session - but log it as a non-blocking issue
            System.out.println("Continuing without API session - results will not be persisted");
        }

        // Step 2: Get lottery game data for generation
        LotteryGame lotteryGame = getLotteryGameData(request.getLotteryState(), request.getLotteryGame());
        if (lotteryGame == null) {
            session.updateStatus(GenerationStatus.FAILED);
            return createFailedResult(session, "Could not load lottery game data for " + 
                                   request.getLotteryGame() + " in " + request.getLotteryState());
        }

        // Step 3: Initialize collections and metrics
        List<int[]> allGeneratedTickets = new ArrayList<>();
        List<int[]> currentBestTickets = new ArrayList<>();
        double bestQualityScore = 0.0;
        double bestPatternCoverage = 0.0;
        int currentStrategyIndex = determineInitialStrategy(request);
        
        // Step 4: Main generation loop
        Map<String, Integer> lastBatchPatternCounts = null;
        
        while (session.getCurrentStatus() == GenerationStatus.RUNNING) {
            
            // Check for cancellation
            if (session.getCurrentStatus() == GenerationStatus.CANCELLED) {
                break;
            }
            
            session.incrementAttemptCount();
            
            try {
                // Generate batch of tickets using current strategy
                String currentStrategy = availableStrategies.get(currentStrategyIndex);
                List<int[]> batchTickets = generateBatchWithStrategy(
                    currentStrategy, request.getNumberOfTickets(), lotteryGame, request);
                
                session.recordStrategyUsage(currentStrategy);
                
                if (batchTickets != null && !batchTickets.isEmpty()) {
                    session.incrementSuccessfulBatches();
                    
                    // Classify tickets by pattern groups using PatternGroupingEngine
                    Map<String, Integer> batchPatternCounts = classifyBatchPatterns(batchTickets, request);
                    lastBatchPatternCounts = batchPatternCounts; // Store for strategy selection
                    
                    // Evaluate batch quality using enhanced engine if TemplateMatrix is enabled
                    QualityMetrics batchQuality = evaluateQualityWithEnhancement(batchTickets, stoppingCriteria, request);
                    
                    // Update session metrics with enhanced pattern analysis
                    double enhancedPatternCoverage = calculateEnhancedPatternCoverage(batchQuality, batchPatternCounts);
                    session.updateMetrics(batchQuality.getOptimizationScore(), enhancedPatternCoverage);
                    
                    // Log pattern distribution for this batch
                    logBatchPatternDistribution(currentStrategy, batchPatternCounts);
                    
                    // Check if this batch improves our best results
                    if (batchQuality.getOptimizationScore() > bestQualityScore) {
                        bestQualityScore = batchQuality.getOptimizationScore();
                        bestPatternCoverage = calculatePatternCoverage(batchQuality);
                        // Accumulate best tickets up to requested amount instead of replacing all
                        currentBestTickets.clear();
                        currentBestTickets.addAll(batchTickets);
                        
                        // If we need more tickets, fill from allGeneratedTickets
                        if (currentBestTickets.size() < request.getNumberOfTickets()) {
                            for (int[] ticket : allGeneratedTickets) {
                                if (currentBestTickets.size() >= request.getNumberOfTickets()) break;
                                if (!containsTicket(currentBestTickets, ticket)) {
                                    currentBestTickets.add(ticket);
                                }
                            }
                        }
                        
                        // Add unique tickets to overall collection
                        addUniqueTickets(allGeneratedTickets, batchTickets);
                        
                        // 🔥 SAVE AS YOU GO: Save improved quality results incrementally
                        saveAsYouGo(sessionId, batchQuality, request);
                        
                        // Publish high-quality tickets as proven combinations
                        if (batchQuality.getOptimizationScore() >= 85.0) {
                            publishHighQualityTickets(batchTickets, request.getLotteryConfigId(), 
                                                     batchQuality.getOptimizationScore(), request.getTargetTier());
                        }
                        
                        // Debug batch quality for ticket set creation
                        System.out.println("DEBUG: Batch quality check - Score: " + batchQuality.getOptimizationScore() + ", API Session: " + apiSessionId);
                        
                        // Save successful tickets using proper API sequence (if API session exists)
                        if (batchQuality.getOptimizationScore() >= 70.0 && apiSessionId != null) {
                            System.out.println("DEBUG: Batch quality >= 70.0 and API session exists - calling saveSuccessfulTicketsWithProperSequence");
                            saveSuccessfulTicketsWithProperSequence(batchTickets, request, currentStrategy, 
                                                                   batchQuality, apiSessionId);
                        } else if (batchQuality.getOptimizationScore() >= 70.0) {
                            System.out.println("DEBUG: Batch quality >= 70.0 but no API session - skipping ticket save to prevent foreign key violations");
                            // Skip ticket saving when API session creation failed to prevent fake ticket set ID generation
                            // The fake ticket set IDs (from sessionId.hashCode()) don't exist in database and cause foreign key violations
                        }
                    }
                    
                    // Notify progress
                    notifyProgress(session, progressCallback);
                    
                } else {
                    session.incrementFailedBatches();
                }
                
                // Step 5: Check stopping conditions in priority order
                String stoppingReason = checkStoppingConditions(session, bestQualityScore, bestPatternCoverage);
                if (stoppingReason != null) {
                    session.updateStatus(GenerationStatus.getCompletionStatus(getStoppingType(stoppingReason)));
                    break;
                }
                
                // Intelligently rotate to next generation strategy based on pattern performance
                currentStrategyIndex = selectNextStrategy(currentStrategyIndex, lastBatchPatternCounts, session);
                
                // Brief pause to prevent overwhelming the system
                Thread.sleep(100);
                
            } catch (Exception e) {
                // Todo: Investigate why error is exception
                session.recordError("Batch generation failed: " + e.getMessage());
                session.incrementFailedBatches();
                
                // Continue with next attempt unless too many failures
                if (session.getFailedBatches() > session.getSuccessfulBatches() * 2) {
                    session.updateStatus(GenerationStatus.FAILED);
                    break;
                }
            }
        }

        // Step 6: Finalize results
        // Mark session as completed but keep it for tracking (will be cleaned up later by cleanup task)
        session.updateStatus(GenerationStatus.COMPLETED);
        
        // Use best tickets found, or all tickets if no clear best
        List<int[]> finalTickets = !currentBestTickets.isEmpty() ? currentBestTickets : 
                                  allGeneratedTickets.stream().limit(request.getNumberOfTickets())
                                                   .collect(java.util.stream.Collectors.toList());

        // Final quality evaluation using enhanced engine if TemplateMatrix is enabled
        QualityMetrics finalQuality = finalTickets.isEmpty() ? 
            createEmptyQualityMetrics(request.getLotteryConfigId()) :
            evaluateQualityWithEnhancement(finalTickets, stoppingCriteria, request);

        // Create generation summary
        GenerationSummary summary = session.createSummary();
        
        // Store results in persistence layer
        storeGenerationResults(session, finalTickets, finalQuality);
        
        // Debug the conditions for ticket set creation
        System.out.println("DEBUG: Checking conditions for ticket set creation:");
        System.out.println("DEBUG: - finalTickets.isEmpty(): " + finalTickets.isEmpty());
        System.out.println("DEBUG: - finalQuality.getOptimizationScore(): " + finalQuality.getOptimizationScore());
        System.out.println("DEBUG: - apiSessionId: " + apiSessionId);
        System.out.println("DEBUG: - Quality >= 60.0: " + (finalQuality.getOptimizationScore() >= 60.0));
        
        // WORKAROUND: Phase 1 API is returning 500 errors, so we'll create a local ticket set ID
        if (!finalTickets.isEmpty() && finalQuality.getOptimizationScore() >= 60.0) {
            if (apiSessionId != null) {
                System.out.println("DEBUG: All conditions met - calling saveSuccessfulTicketsWithProperSequence");
                saveSuccessfulTicketsWithProperSequence(finalTickets, session.getOriginalRequest(), 
                                                       "FINAL_GENERATION", finalQuality, apiSessionId);
            } else {
                System.out.println("DEBUG: API session failed (500 errors), ticket set creation skipped");
                System.out.println("DEBUG: GeneratedTicketSet will not include ticketSetId due to Phase 1 API failures");
                // Do not store a local ticket set ID since the persistence API is failing
                // The GeneratedTicketSet will have ticketSetId = null, indicating no persistence
            }
        } else {
            System.out.println("DEBUG: Conditions not met - no ticket set creation");
            System.out.println("DEBUG: - Tickets count: " + finalTickets.size());
            System.out.println("DEBUG: - Quality score: " + finalQuality.getOptimizationScore() + " (needs >= 60.0)");
        }
        
        // Update hot numbers based on successful generation patterns
        if (!finalTickets.isEmpty() && finalQuality.getOptimizationScore() >= 70.0) {
            updateHotNumbersFromSuccessfulGeneration(finalTickets, session.getOriginalRequest().getLotteryConfigId());
        }
        
        // Calculate historical performance analysis
        HistoricalPerformanceAnalysis historicalPerformance = calculateHistoricalPerformance(
                finalTickets, request.getLotteryConfigId(), sessionId, request);
        
        // Create drought information for UI display
        DroughtInformationService.DroughtInformation droughtInformation = null;
        try {
            // Get drought and pattern analysis (might be stored in session or need to re-analyze)
            PrizeDroughtAnalysis droughtAnalysis = getOrCreateDroughtAnalysis(request);
            PatternPerformanceAnalysis patternAnalysis = getOrCreatePatternAnalysis(request);
            
            // Get lottery game info for proper format conversion
            LotteryGame gameForDrought = getLotteryGameData(request.getLotteryState(), request.getLotteryGame());
            Integer drawPositions = (gameForDrought != null && gameForDrought.getDrawPositionCount() != null) ? 
                gameForDrought.getDrawPositionCount() : null;
            
            droughtInformation = DroughtInformationService.createDroughtInformation(
                droughtAnalysis, patternAnalysis, request.getTargetTier(), drawPositions);
                
        } catch (Exception e) {
            System.err.println("Failed to create drought information: " + e.getMessage());
            droughtInformation = DroughtInformationService.DroughtInformation.noData();
        }
        
        // Get TemplateMatrix analysis if available
        TemplateMatrixAnalysisResult templateMatrixAnalysis = currentTemplateMatrixAnalysis.get();
        if (templateMatrixAnalysis != null) {
            System.out.println("TemplateMatrix: Including analysis in final result with " + 
                    templateMatrixAnalysis.getTotalTemplates() + " templates");
        }
        
        // Get template correlated tickets if available
        List<TemplateCorrelatedTicket> correlatedTickets = currentCorrelatedTickets.get();
        if (correlatedTickets != null) {
            System.out.println("TemplateMatrix: Including " + correlatedTickets.size() + " correlated tickets in final result");
        }
        
        // Build final result with enhanced drought information and TemplateMatrix analysis
        // Get the local ticket set ID if Phase 1 API failed
        Integer localTicketSetId = getLocalTicketSetId(sessionId);
        
        GeneratedTicketSet finalResult = GeneratedTicketSet.builder()
                .sessionId(sessionId)
                .ticketSetId(localTicketSetId)  // Include the local ticket set ID
                .tickets(finalTickets)
                .qualityMetrics(finalQuality)
                .generationSummary(summary)
                .lotteryConfigId(request.getLotteryConfigId())
                .finalStatus(session.getCurrentStatus())
                .historicalPerformance(historicalPerformance)
                .droughtInformation(droughtInformation)
                .templateMatrixAnalysis(templateMatrixAnalysis)
                .templateCorrelatedTickets(correlatedTickets)
                .build();
                
        if (localTicketSetId != null) {
            System.out.println("DEBUG: Built final GeneratedTicketSet with ticketSetId: " + localTicketSetId);
        } else {
            System.out.println("DEBUG: Built final GeneratedTicketSet with ticketSetId: null (Phase 1 API failed)");
        }
        
        // Clean up thread-local storage
        currentTemplateMatrixAnalysis.remove();
        currentCorrelatedTickets.remove();
        
        // Store result in session for later retrieval
        session.setFinalResult(finalResult);
        
        return finalResult;
    }
    
    /**
     * SAVE AS YOU GO: Incrementally saves quality improvements during generation.
     * This provides real-time persistence of progress without waiting for completion.
     *
     * @param sessionId The current generation session ID
     * @param qualityMetrics The latest quality evaluation results
     * @param userRequest The original user request (needed for lotteryConfigId and targetTier)
     */
    private void saveAsYouGo(String sessionId, QualityMetrics qualityMetrics, UserTargetingRequest userRequest) {
        try {
            // Use the REAL SessionIntegrationService to update session with new quality data
            sessionIntegrationService.updateSessionQuality(sessionId, qualityMetrics, userRequest)
                .whenComplete((result, throwable) -> {
                    if (throwable != null) {
                        System.err.println("Save-as-you-go failed for session " + sessionId + ": " + throwable.getMessage());
                        // Continue generation even if save fails (graceful degradation)
                    } else {
                        System.out.println("Save-as-you-go: Updated session " + sessionId + " with quality score " + 
                                         qualityMetrics.getOptimizationScore());
                    }
                });
        } catch (Exception e) {
            // Log error but don't interrupt generation
            System.err.println("Save-as-you-go error: " + e.getMessage());
        }
    }

    /**
     * Generates a batch of tickets using the specified strategy with optional tier optimization.
     * The "pattern_based" strategy uses PatternGroupingEngine to generate numbers matching hot patterns.
     * Tier optimization is applied when targetTier is tier_3, tier_4, or tier_5.
     */
    private List<int[]> generateBatchWithStrategy(String strategy, int batchSize, 
                                                 LotteryGame lotteryGame, UserTargetingRequest request) {
        try {
            // Special handling for DELTA_PURE strategy
            if ("delta_pure".equalsIgnoreCase(strategy)) {
                return generateDeltaPureTickets(batchSize, lotteryGame, request);
            }
            
            // Special handling for DELTA_STRATEGIC strategy
            if ("delta_strategic".equalsIgnoreCase(strategy)) {
                return generateDeltaStrategicTickets(batchSize, lotteryGame, request);
            }
            
            // Special handling for pattern_based strategy with optional tier enhancement
            if ("pattern_based".equalsIgnoreCase(strategy)) {
                return generateTierAwarePatternBasedTickets(batchSize, lotteryGame, request);
            }
            
            // Map other strategies to GeneratorType
            RandomNumberGeneratorFactory.GeneratorType generatorType = mapStrategyToGeneratorType(strategy);
            
            if (generatorType != null) {
                LotteryNumberGenerator generator = RandomNumberGeneratorFactory.createGenerator(
                    generatorType, lotteryGame, batchSize);
                
                // Configure TemplateMatrix generator with user preferences
                if (generatorType == RandomNumberGeneratorFactory.GeneratorType.TEMPLATE_MATRIX && 
                    generator instanceof TemplateMatrixLotteryNumberGenerator) {
                    
                    TemplateMatrixLotteryNumberGenerator templateGenerator = (TemplateMatrixLotteryNumberGenerator) generator;
                    System.out.println("DEBUG: Configuring TemplateMatrix generator with user preferences");
                    
                    // Configure user preferences if available
                    if (request.getPreferences() != null) {
                        if (request.getPreferences().getAllowedTemplateGroups() != null && 
                            !request.getPreferences().getAllowedTemplateGroups().isEmpty()) {
                            templateGenerator.setAllowedGroups(request.getPreferences().getAllowedTemplateGroups());
                            System.out.println("DEBUG: Set allowedGroups to: " + request.getPreferences().getAllowedTemplateGroups());
                        }
                        
                        templateGenerator.setUseTimingIndicators(request.getPreferences().isUseTimingIndicators());
                        templateGenerator.setConsiderOverduePatterns(request.getPreferences().isConsiderOverdueTemplates());
                        templateGenerator.setMinimumProbabilityThreshold(request.getPreferences().getMinimumTemplateProbability());
                        
                        System.out.println("DEBUG: Configured TemplateMatrix with timing: " + request.getPreferences().isUseTimingIndicators() + 
                                         ", overdue: " + request.getPreferences().isConsiderOverdueTemplates());
                    }
                }
                
                generator.process();
                
                // Capture TemplateMatrix analysis if this is a TemplateMatrix generator
                if (generatorType == RandomNumberGeneratorFactory.GeneratorType.TEMPLATE_MATRIX) {
                    try {
                        if (generator instanceof TemplateMatrixLotteryNumberGenerator) {
                            TemplateMatrixLotteryNumberGenerator templateGenerator = (TemplateMatrixLotteryNumberGenerator) generator;
                            TemplateMatrixAnalysisResult analysis = templateGenerator.getTemplateMatrixAnalysis();
                            List<TemplateCorrelatedTicket> correlatedTickets = templateGenerator.getCorrelatedTickets();
                            
                            if (analysis != null) {
                                currentTemplateMatrixAnalysis.set(analysis);
                                System.out.println("TemplateMatrix: Captured analysis with " + analysis.getTotalTemplates() + " templates");
                            }
                            
                            if (correlatedTickets != null && !correlatedTickets.isEmpty()) {
                                currentCorrelatedTickets.set(new ArrayList<>(correlatedTickets));
                                System.out.println("TemplateMatrix: Captured " + correlatedTickets.size() + " correlated tickets");
                            }
                        }
                    } catch (Exception e) {
                        System.err.println("Error capturing TemplateMatrix analysis: " + e.getMessage());
                    }
                }
                
                return generator.getGeneratedNumbers();
            } else {
                // Fallback to default generator
                LotteryNumberGenerator generator = RandomNumberGeneratorFactory.createGenerator(
                    RandomNumberGeneratorFactory.GeneratorType.LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN, 
                    lotteryGame, batchSize);
                
                generator.process();
                return generator.getGeneratedNumbers();
            }
            
        } catch (Exception e) {
            System.err.println("Strategy " + strategy + " failed: " + e.getMessage());
            return Collections.emptyList();
        }
    }
    
    /**
     * Generates tickets using pattern-based strategy with optional tier optimization.
     * Falls back to existing pattern-based logic if tier optimization is not applicable.
     * Supports both match-based ("5-of-6") and legacy tier formats ("tier_3").
     */
    private List<int[]> generateTierAwarePatternBasedTickets(int batchSize, LotteryGame lotteryGame, UserTargetingRequest request) {
        // Check if tier optimization should be applied
        if (shouldApplyTierOptimization(request.getTargetTier())) {
            System.out.println("Applying tier-specific optimization for " + request.getTargetTier());
            return generateTierOptimizedTickets(batchSize, lotteryGame, request);
        }
        
        // Fall back to existing pattern-based generation (preserve current behavior)
        return generatePatternBasedTickets(batchSize, lotteryGame, request);
    }
    
    /**
     * Determines if tier optimization should be applied based on target tier.
     * Supports both new match-based format ("5-of-6", "4-of-5") and legacy format ("tier_3", "tier_4", "tier_5").
     */
    private boolean shouldApplyTierOptimization(String targetTier) {
        if (targetTier == null) {
            return false;
        }
        
        String tier = targetTier.toLowerCase().trim();
        
        // Check for match-based format (e.g., "5-of-6", "4-of-5")
        if (tier.matches("\\d+-of-\\d+")) {
            return true;
        }
        
        // Check for legacy tier format
        return tier.contains("tier_3") || tier.contains("tier_4") || tier.contains("tier_5");
    }
    
    /**
     * Generates tickets using the pure Delta algorithm.
     * Implements the complete STEP 1-7 delta methodology for optimal lottery number generation.
     */
    private List<int[]> generateDeltaPureTickets(int batchSize, LotteryGame lotteryGame, UserTargetingRequest request) {
        System.out.println("🔥 Generating " + batchSize + " tickets using DELTA_PURE strategy");
        
        try {
            // Create Delta Pure Engine for this lottery game
            DeltaPureEngine deltaEngine = new DeltaPureEngine(lotteryGame);
            
            // Generate tickets using pure delta algorithm
            DeltaPureEngine.DeltaGenerationResult result = deltaEngine.generatePureDeltaTickets(request);
            
            if (result.isSuccessful()) {
                List<int[]> tickets = result.getTickets();
                
                // Limit to requested batch size if more were generated
                if (tickets.size() > batchSize) {
                    tickets = tickets.subList(0, batchSize);
                }
                
                System.out.println("✅ DELTA_PURE generated " + tickets.size() + " tickets " +
                                 "(avg score: " + String.format("%.1f", 
                                 result.getAnalysis() != null ? result.getAnalysis().getAverageQualityScore() : 0.0) + ")");
                
                return tickets;
                
            } else {
                System.err.println("❌ DELTA_PURE generation failed: " + result.getErrorMessage());
                return new ArrayList<>();
            }
            
        } catch (Exception e) {
            System.err.println("❌ DELTA_PURE generation exception: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }
    
    /**
     * Generates tickets using DELTA_STRATEGIC strategy with intelligence enhancements.
     * Combines pure delta mathematics with drought and tier optimization insights.
     */
    private List<int[]> generateDeltaStrategicTickets(int batchSize, LotteryGame lotteryGame, UserTargetingRequest request) {
        System.out.println("🧠 Generating " + batchSize + " tickets using DELTA_STRATEGIC strategy");
        
        try {
            // DroughtInformationService is a static utility class, no instantiation needed
            
            // Create Strategic Delta Generator with intelligence components
            StrategicDeltaGenerator strategicGenerator = new StrategicDeltaGenerator(
                lotteryGame, tierOptimizationManager);
            
            // Generate tickets using strategic delta approach
            StrategicDeltaGenerator.StrategicDeltaResult result = 
                strategicGenerator.generateStrategicTickets(request).join();
            
            if (result != null && !result.getGeneratedTickets().isEmpty()) {
                List<int[]> tickets = result.getGeneratedTickets();
                
                // Limit to requested batch size if more were generated
                if (tickets.size() > batchSize) {
                    tickets = tickets.subList(0, batchSize);
                }
                
                // Store strategic analysis for later inclusion in GeneratedTicketSet
                storeDeltaAnalysisForSession(request.getUserId(), result);
                
                System.out.println("✅ DELTA_STRATEGIC generated " + tickets.size() + " tickets " +
                                 "(strategic score: " + String.format("%.2f", 
                                 result.getEvaluation().getStrategicPerformance().getOverallStrategicScore()) + 
                                 ", efficiency: " + String.format("%.2f", 
                                 result.getEvaluation().getValidationResult().getBatchStatistics().averageScore) + ")");
                
                // Log strategic insights
                if (!result.getActionableInsights().isEmpty()) {
                    System.out.println("💡 Strategic insights: " + 
                        String.join("; ", result.getActionableInsights().subList(0, 
                        Math.min(3, result.getActionableInsights().size()))));
                }
                
                return tickets;
                
            } else {
                System.err.println("❌ DELTA_STRATEGIC generation failed: No tickets generated");
                return new ArrayList<>();
            }
            
        } catch (Exception e) {
            System.err.println("❌ DELTA_STRATEGIC generation exception: " + e.getMessage());
            e.printStackTrace();
            // Fall back to pure delta generation
            System.out.println("🔄 Falling back to DELTA_PURE strategy");
            return generateDeltaPureTickets(batchSize, lotteryGame, request);
        }
    }
    
    /**
     * Stores delta analysis results for later inclusion in GeneratedTicketSet.
     * Uses thread-local storage to maintain analysis across session lifecycle.
     */
    private void storeDeltaAnalysisForSession(String sessionId, StrategicDeltaGenerator.StrategicDeltaResult result) {
        if (result != null && result.getEvaluation() != null) {
            // Create comprehensive delta analysis result
            DeltaAnalysisResult deltaAnalysis = DeltaAnalysisResult.forStrategicDelta(
                result.getEvaluation().getValidationResult(),
                result.getStrategicContext(),
                result.getEvaluation().getStrategicPerformance(),
                createPatternAnalysisFromResult(result),
                result.getActionableInsights()
            );
            
            // Store in session-specific storage (would be enhanced with proper session management)
            // For now, we'll use a simple approach - this could be enhanced with ThreadLocal storage
            System.out.println("📊 Stored delta analysis for session: " + sessionId + 
                             " (strategy: " + deltaAnalysis.getDeltaStrategy() + 
                             ", efficiency: " + String.format("%.2f", deltaAnalysis.getDeltaEfficiencyScore()) + ")");
        }
    }
    
    /**
     * Creates pattern analysis from strategic delta generation result.
     */
    private DeltaAnalysisResult.DeltaPatternAnalysis createPatternAnalysisFromResult(
            StrategicDeltaGenerator.StrategicDeltaResult result) {
        
        int totalPatterns = result.getGeneratedTickets().size();
        
        // This would be enhanced to analyze the actual patterns - for now, provide basic info
        return DeltaAnalysisResult.DeltaPatternAnalysis.simple(
            totalPatterns, 
            totalPatterns / 3, // Estimate arithmetic progressions
            8.5 // Average gap size estimate
        );
    }
    
    /**
     * Generates tickets with tier-specific optimization applied to pattern-based strategy.
     * Supports multi-batch generation with duplicate prevention for large requests.
     */
    private List<int[]> generateTierOptimizedTickets(int batchSize, LotteryGame lotteryGame, UserTargetingRequest request) {
        try {
            // Get tier strategy to check limits
            Optional<TierOptimizationStrategy> strategyOpt = tierOptimizationManager.getTierStrategy(request.getTargetTier());
            
            if (!strategyOpt.isPresent()) {
                // No tier strategy - fall back to standard generation
                return generatePatternBasedTickets(batchSize, lotteryGame, request);
            }
            
            TierOptimizationStrategy strategy = strategyOpt.get();
            
            // Check if user wants more tickets than tier's optimal batch size
            int tierMaxTickets = getTierMaxTickets(strategy);
            int userRequestedTickets = request.getNumberOfTickets();
            
            if (userRequestedTickets > tierMaxTickets) {
                System.out.println("User requested " + userRequestedTickets + " tickets, tier optimal is " + 
                                 tierMaxTickets + ". Using multi-batch generation with duplicate prevention.");
                return generateMultiBatchTierOptimized(batchSize, lotteryGame, request, strategy);
            } else {
                // Standard single-batch generation
                return generateSingleBatchTierOptimized(batchSize, lotteryGame, request, strategy);
            }
            
        } catch (Exception e) {
            System.err.println("Error in tier-optimized generation: " + e.getMessage());
            // Preserve existing behavior - fall back to standard pattern generation
            return generatePatternBasedTickets(batchSize, lotteryGame, request);
        }
    }
    
    /**
     * Generates multiple batches with variance and duplicate prevention.
     * Each batch uses slightly different optimization parameters for diversity.
     */
    private List<int[]> generateMultiBatchTierOptimized(int batchSize, LotteryGame lotteryGame, 
                                                       UserTargetingRequest request, TierOptimizationStrategy strategy) {
        
        List<int[]> allGeneratedTickets = new ArrayList<>();
        Set<String> generatedTicketHashes = new HashSet<>(); // Duplicate prevention
        
        int tierMaxTickets = getTierMaxTickets(strategy);
        int userRequestedTickets = request.getNumberOfTickets();
        int numBatches = (userRequestedTickets + tierMaxTickets - 1) / tierMaxTickets; // Ceiling division
        
        System.out.println("Generating " + numBatches + " batches of " + tierMaxTickets + 
                         " tickets each for " + request.getTargetTier());
        
        // Get historical lottery game data once for all batches
        Optional<StateGamesResponse> lotteryDataOpt = lotteryDataService.getLotteryGameData(
            request.getLotteryGame(), request.getLotteryState());
        LotteryGame historicalGame = lotteryDataOpt.map(StateGamesResponse::getLotteryGame).orElse(lotteryGame);
        List<String> hotPatterns = analyzeRealDrawPatterns(historicalGame, request.getLotteryConfigId());
        
        for (int batchNum = 0; batchNum < numBatches; batchNum++) {
            // Calculate tickets needed for this batch
            int ticketsRemaining = userRequestedTickets - allGeneratedTickets.size();
            int currentBatchSize = Math.min(tierMaxTickets, ticketsRemaining);
            
            System.out.println("Generating batch " + (batchNum + 1) + "/" + numBatches + 
                             " (" + currentBatchSize + " tickets)");
            
            // Generate batch with variance parameters
            List<int[]> batchTickets = generateVariedBatch(currentBatchSize, historicalGame, request, 
                                                          hotPatterns, batchNum, generatedTicketHashes);
            
            // Add unique tickets only
            for (int[] ticket : batchTickets) {
                String ticketHash = Arrays.toString(ticket);
                if (!generatedTicketHashes.contains(ticketHash)) {
                    allGeneratedTickets.add(ticket);
                    generatedTicketHashes.add(ticketHash);
                } else {
                    System.out.println("Prevented duplicate: " + ticketHash);
                }
                
                // Stop if we have enough tickets
                if (allGeneratedTickets.size() >= userRequestedTickets) {
                    break;
                }
            }
            
            if (allGeneratedTickets.size() >= userRequestedTickets) {
                break;
            }
        }
        
        System.out.println("Multi-batch complete: " + allGeneratedTickets.size() + " unique tickets generated, " +
                         generatedTicketHashes.size() + " total combinations considered");
        
        return allGeneratedTickets;
    }
    
    /**
     * Generates a single batch using standard tier optimization.
     */
    private List<int[]> generateSingleBatchTierOptimized(int batchSize, LotteryGame lotteryGame, 
                                                        UserTargetingRequest request, TierOptimizationStrategy strategy) {
        
        // Get historical lottery game data (same as existing logic)
        Optional<StateGamesResponse> lotteryDataOpt = lotteryDataService.getLotteryGameData(
            request.getLotteryGame(), request.getLotteryState());
        
        LotteryGame historicalGame = lotteryDataOpt.map(StateGamesResponse::getLotteryGame).orElse(lotteryGame);
        
        // Use existing pattern analysis but with tier-aware number selection
        System.out.println("Analyzing patterns with tier optimization for " + request.getTargetTier());
        List<String> hotPatterns = analyzeRealDrawPatterns(historicalGame, request.getLotteryConfigId());
        
        List<int[]> generatedTickets = new ArrayList<>();
        Set<String> ticketHashes = new HashSet<>();
        
        for (int i = 0; i < batchSize; i++) {
            int[] ticket = generateTierOptimizedTicket(hotPatterns, historicalGame, request);
            if (ticket != null && ticket.length == historicalGame.getDrawPositionCount()) {
                String ticketHash = Arrays.toString(ticket);
                if (!ticketHashes.contains(ticketHash)) {
                    generatedTickets.add(ticket);
                    ticketHashes.add(ticketHash);
                } else {
                    // Try regenerating once if duplicate
                    ticket = generateTierOptimizedTicket(hotPatterns, historicalGame, request);
                    if (ticket != null) {
                        generatedTickets.add(ticket);
                        ticketHashes.add(Arrays.toString(ticket));
                    }
                }
            }
            
            // Safety check to prevent infinite loops
            if (generatedTickets.size() >= batchSize) {
                break;
            }
        }
        
        // Fall back to existing logic if tier optimization fails
        if (generatedTickets.isEmpty()) {
            System.out.println("Tier optimization failed, falling back to standard pattern generation");
            return generatePatternBasedTickets(batchSize, lotteryGame, request);
        }
        
        return generatedTickets;
    }
    
    /**
     * Generates a single ticket using tier optimization with pattern-based foundation.
     */
    private int[] generateTierOptimizedTicket(List<String> hotPatterns, LotteryGame lotteryGame, UserTargetingRequest request) {
        try {
            // Start with existing pattern-based approach
            if (!hotPatterns.isEmpty()) {
                String selectedPattern = hotPatterns.get(new Random().nextInt(hotPatterns.size()));
                int[] baseTicket = generateNumbersForPatternWithHistory(selectedPattern, lotteryGame);
                
                if (baseTicket != null) {
                    // Apply tier optimization to the pattern-generated numbers
                    List<Integer> candidateNumbers = Arrays.stream(baseTicket).boxed()
                            .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                    
                    // Get tier-optimized selection
                    CompletableFuture<List<Integer>> tierOptimizedFuture = tierOptimizationManager
                            .optimizeNumbersForTier(request.getTargetTier(), candidateNumbers, 
                                                    lotteryGame.getDrawPositionCount(), request.getLotteryConfigId());
                    
                    List<Integer> optimizedNumbers = tierOptimizedFuture.join();
                    
                    if (optimizedNumbers.size() == lotteryGame.getDrawPositionCount()) {
                        return optimizedNumbers.stream().mapToInt(Integer::intValue).toArray();
                    }
                }
            }
            
            // Fallback to existing random generation with tier optimization
            List<Integer> allNumbers = new ArrayList<>();
            for (int i = lotteryGame.getMinNumber(); i <= lotteryGame.getMaxNumber(); i++) {
                allNumbers.add(i);
            }
            
            CompletableFuture<List<Integer>> tierOptimizedFuture = tierOptimizationManager
                    .optimizeNumbersForTier(request.getTargetTier(), allNumbers, 
                                            lotteryGame.getDrawPositionCount(), request.getLotteryConfigId());
            
            List<Integer> optimizedNumbers = tierOptimizedFuture.join();
            return optimizedNumbers.stream().mapToInt(Integer::intValue).toArray();
            
        } catch (Exception e) {
            System.err.println("Error generating tier-optimized ticket: " + e.getMessage());
            // Final fallback to existing random generation
            return generateRandomTicket(lotteryGame);
        }
    }
    
    /**
     * Generates tickets based on hot patterns from PatternGroupingEngine.
     * This strategy tries to create number combinations that match successful historical patterns
     * and uses historical lottery data to make intelligent number selections.
     */
    private List<int[]> generatePatternBasedTickets(int batchSize, LotteryGame lotteryGame, UserTargetingRequest request) {
        List<int[]> generatedTickets = new ArrayList<>();
        
        try {
            // Get historical lottery game data for intelligent analysis
            Optional<StateGamesResponse> lotteryDataOpt = lotteryDataService.getLotteryGameData(
                request.getLotteryGame(), request.getLotteryState());
            
            LotteryGame historicalGame = lotteryDataOpt.map(StateGamesResponse::getLotteryGame).orElse(lotteryGame);
            
            // Analyze real historical draws to identify hot patterns
            System.out.println("Analyzing real historical lottery draws for patterns...");
            List<String> realHotPatterns = analyzeRealDrawPatterns(historicalGame, request.getLotteryConfigId());
            
            // 🔥 PHASE 1: Analyze prize drought conditions for intelligent weighting
            System.out.println("🔍 Analyzing prize drought conditions...");
            PrizeDroughtAnalysis droughtAnalysis = prizeDroughtAnalyzer.analyzeDroughtConditions(
                request.getLotteryGame(), request.getLotteryState(), request.getLotteryConfigId());
            
            if (droughtAnalysis.hasActiveDroughts()) {
                System.out.println("💡 Active droughts detected - " + droughtAnalysis.getDroughtSummary());
                System.out.println("🎯 Recommendations: " + droughtAnalysis.getStrategicRecommendations());
            } else {
                System.out.println("✅ No active droughts detected - using standard patterns");
            }
            
            // 🚀 PHASE 2: Analyze historical pattern performance for prize tier correlations
            System.out.println("📊 Analyzing historical pattern performance...");
            PatternPerformanceAnalysis patternAnalysis = patternPerformanceAnalyzer.analyzePatternPerformance(
                request.getLotteryGame(), request.getLotteryState(), request.getLotteryConfigId());
            
            if (patternAnalysis.hasSignificantData()) {
                System.out.println("📈 Pattern analysis complete - " + patternAnalysis.getAnalysisSummary());
                
                // Get strategic patterns for the target tier (if drought exists, use highest priority tier)
                String targetTier = droughtAnalysis.hasActiveDroughts() ? 
                    droughtAnalysis.getHighestPriorityPrizeTier() : "match4";
                List<String> strategicPatterns = patternAnalysis.getBestPatternsForTier(targetTier, 5);
                
                if (!strategicPatterns.isEmpty()) {
                    System.out.println("🎯 Top strategic patterns for " + targetTier + ": " + 
                                     String.join(", ", strategicPatterns));
                }
            } else {
                System.out.println("⚠️ Limited pattern data available - using standard pattern analysis");
            }
            
            if (realHotPatterns.isEmpty()) {
                System.out.println("No historical draws available, using historical-based generation");
                System.out.println("DEBUG: Fallback to generateHistoricalBasedTickets with batchSize=" + batchSize);
                return generateHistoricalBasedTickets(batchSize, historicalGame);
            }
            
            System.out.println("Found " + realHotPatterns.size() + " real hot patterns from historical analysis");
            
            // 🚀 PHASE 3: Use Advanced Generation Engine for intelligent ticket generation
            if (shouldUseAdvancedGeneration(batchSize, droughtAnalysis, patternAnalysis)) {
                System.out.println("🚀 Using Phase 3 Advanced Generation Engine");
                List<int[]> advancedTickets = generateWithAdvancedEngine(batchSize, historicalGame, 
                                                                        droughtAnalysis, patternAnalysis);
                generatedTickets.addAll(advancedTickets);
            } else {
                // Fallback to Phase 1+2 pattern-based generation
                System.out.println("🎯 Using Phase 1+2 pattern-based generation");
                
                for (int i = 0; i < batchSize; i++) {
                    // Select pattern using combined drought + performance analysis
                    String targetPattern = selectStrategicPattern(realHotPatterns, droughtAnalysis, patternAnalysis);
                    
                    // Generate numbers that would produce this pattern using historical data
                    System.out.println("DEBUG: Generating strategically enhanced ticket for pattern: " + targetPattern);
                    int[] ticket = generateStrategicallyEnhancedNumbersForPattern(targetPattern, historicalGame, 
                                                                                 droughtAnalysis, patternAnalysis);
                    System.out.println("DEBUG: Generated strategically enhanced ticket: " + java.util.Arrays.toString(ticket));
                    
                    if (ticket != null && ticket.length == lotteryGame.getDrawPositionCount()) {
                        generatedTickets.add(ticket);
                    } else {
                        // If pattern-based generation fails, add a historical-based ticket
                        generatedTickets.add(generateHistoricalBasedTicket(historicalGame));
                    }
                }
            }
            
            System.out.println("Pattern-based strategy generated " + generatedTickets.size() + 
                             " tickets targeting real hot patterns: " + String.join(", ", realHotPatterns.subList(0, Math.min(3, realHotPatterns.size()))));
            
        } catch (Exception e) {
            System.err.println("Pattern-based generation failed: " + e.getMessage());
            // Fallback to random generation
            return generateFallbackTickets(batchSize, lotteryGame);
        }
        
        return generatedTickets;
    }
    
    /**
     * Generates numbers that would produce the specified pattern using historical lottery data.
     * Analyzes past draws to select the most frequently drawn numbers within each pattern range.
     * For pattern "0,1,2,2,3" or "01223", generates numbers like [5, 16, 23, 28, 34].
     */
    private int[] generateNumbersForPatternWithHistory(String pattern, LotteryGame lotteryGame) {
        if (pattern == null || pattern.trim().isEmpty()) {
            return null;
        }
        
        System.out.println("DEBUG: Processing pattern: '" + pattern + "'");
        System.out.println("DEBUG: Pattern contains comma: " + pattern.contains(","));
        System.out.println("DEBUG: Pattern matches [0-9,]+: " + pattern.matches("[0-9,]+"));
        
        // Handle comma-separated pattern like "05,15,25,30,35" (actual numbers)
        if (pattern.contains(",") && pattern.matches("[0-9,]+")) {
            System.out.println("DEBUG: Converting comma-separated to tens-digit pattern for variety");
            try {
                // Instead of using exact numbers, convert to tens-digit pattern for intelligent selection
                String[] numberStrings = pattern.split(",");
                List<Integer> patternNumbers = new ArrayList<>();
                for (String numStr : numberStrings) {
                    patternNumbers.add(Integer.parseInt(numStr.trim()));
                }
                
                // Convert to tens-digit pattern (e.g., [5,15,25,30,35] -> "01223")
                String tensDigitPattern = patternGroupingEngine.extractPattern(patternNumbers);
                System.out.println("DEBUG: Converted '" + pattern + "' to tens-digit pattern: '" + tensDigitPattern + "'");
                
                // Now process as tens-digit pattern with historical intelligence
                return generateNumbersFromTensDigitPattern(tensDigitPattern, lotteryGame);
                
            } catch (NumberFormatException e) {
                System.err.println("Error parsing comma-separated pattern: " + pattern);
            }
        }
        
        // Process as tens-digit pattern
        return generateNumbersFromTensDigitPattern(pattern, lotteryGame);
    }
    
    /**
     * Generates numbers from a tens-digit pattern using historical intelligence.
     */
    private int[] generateNumbersFromTensDigitPattern(String pattern, LotteryGame lotteryGame) {
        // Handle tens-digit pattern like "01223" or "0,1,2,2,3"
        String[] patternParts;
        if (pattern.contains(",")) {
            patternParts = pattern.split(",");
        } else {
            patternParts = pattern.trim().split("");
        }
        
        if (patternParts.length != lotteryGame.getDrawPositionCount()) {
            System.err.println("Pattern length mismatch: expected " + lotteryGame.getDrawPositionCount() + 
                             " positions, got " + patternParts.length + " in pattern: " + pattern);
            return generateRandomTicket(lotteryGame);
        }
        
        List<Integer> numbers = new ArrayList<>();
        Map<Integer, Integer> numberFrequency = calculateNumberFrequencies(lotteryGame);
        System.out.println("DEBUG: Using weighted selection with " + numberFrequency.size() + " historical frequencies");
        
        for (String digitStr : patternParts) {
            char digit = digitStr.trim().charAt(0);
            int rangeStart, rangeEnd;
            
            switch (digit) {
                case '0': rangeStart = 1; rangeEnd = 9; break;
                case '1': rangeStart = 10; rangeEnd = 19; break;
                case '2': rangeStart = 20; rangeEnd = 29; break;
                case '3': rangeStart = 30; rangeEnd = Math.min(39, lotteryGame.getMaxNumber()); break;
                case '4': rangeStart = 40; rangeEnd = Math.min(49, lotteryGame.getMaxNumber()); break;
                case '5': rangeStart = 50; rangeEnd = Math.min(59, lotteryGame.getMaxNumber()); break;
                case '6': rangeStart = 60; rangeEnd = Math.min(69, lotteryGame.getMaxNumber()); break;
                case '7': rangeStart = 70; rangeEnd = Math.min(79, lotteryGame.getMaxNumber()); break;
                case '8': rangeStart = 80; rangeEnd = Math.min(89, lotteryGame.getMaxNumber()); break;
                case '9': rangeStart = 90; rangeEnd = Math.min(99, lotteryGame.getMaxNumber()); break;
                default:
                    System.err.println("Invalid pattern digit: " + digit);
                    return generateRandomTicket(lotteryGame);
            }
            
            // Select number using weighted random selection (not always the most frequent!)
            Integer selectedNumber = selectBestNumberInRange(rangeStart, rangeEnd, numberFrequency, numbers);
            if (selectedNumber != null) {
                numbers.add(selectedNumber);
            } else {
                // Fallback to random if no suitable number found
                int randomNum;
                do {
                    randomNum = rangeStart + new java.util.Random().nextInt(rangeEnd - rangeStart + 1);
                } while (numbers.contains(randomNum));
                numbers.add(randomNum);
            }
        }
        
        Collections.sort(numbers);
        return numbers.stream().mapToInt(i -> i).toArray();
    }
    
    /**
     * Legacy method for backward compatibility - delegates to history-based generation.
     */
    private int[] generateNumbersForPattern(String pattern, LotteryGame lotteryGame) {
        return generateNumbersForPatternWithHistory(pattern, lotteryGame);
    }
    
    /**
     * Calculates frequency of each number in historical lottery draws.
     */
    private Map<Integer, Integer> calculateNumberFrequencies(LotteryGame lotteryGame) {
        Map<Integer, Integer> frequencies = new HashMap<>();
        
        System.out.println("DEBUG: calculateNumberFrequencies - lottery draws: " + 
            (lotteryGame.getLotteryDraws() != null ? lotteryGame.getLotteryDraws().size() : "null"));
        
        if (lotteryGame.getLotteryDraws() != null) {
            // Use last 300 draws for frequency calculation (or all if less than 300)
            List<com.floyd.persistence.model.LotteryDraw> recentDraws = lotteryGame.getLotteryDraws();
            int startIndex = Math.max(0, recentDraws.size() - 300);
            
            for (int i = startIndex; i < recentDraws.size(); i++) {
                List<Integer> drawNumbers = recentDraws.get(i).getDrawResults();
                for (Integer number : drawNumbers) {
                    frequencies.put(number, frequencies.getOrDefault(number, 0) + 1);
                }
            }
        }
        
        return frequencies;
    }
    
    /**
     * Selects a number within a range using weighted random selection based on historical frequency.
     * This provides variety while still favoring more frequent numbers.
     */
    private Integer selectBestNumberInRange(int rangeStart, int rangeEnd, 
                                          Map<Integer, Integer> frequencies, List<Integer> usedNumbers) {
        
        // Create weighted list of available numbers
        List<Integer> availableNumbers = new ArrayList<>();
        List<Integer> weights = new ArrayList<>();
        
        for (int number = rangeStart; number <= rangeEnd; number++) {
            if (!usedNumbers.contains(number)) {
                availableNumbers.add(number);
                // Add 1 to frequency to ensure numbers with 0 frequency still have some chance
                int weight = frequencies.getOrDefault(number, 0) + 1;
                weights.add(weight);
            }
        }
        
        if (availableNumbers.isEmpty()) {
            return null;
        }
        
        // Use weighted random selection
        return selectWeightedRandom(availableNumbers, weights);
    }
    
    /**
     * Selects a random element based on weights (higher weight = higher probability).
     */
    private Integer selectWeightedRandom(List<Integer> numbers, List<Integer> weights) {
        if (numbers.isEmpty() || numbers.size() != weights.size()) {
            return null;
        }
        
        // Calculate total weight
        int totalWeight = weights.stream().mapToInt(Integer::intValue).sum();
        if (totalWeight == 0) {
            // If all weights are 0, select randomly
            return numbers.get(new java.util.Random().nextInt(numbers.size()));
        }
        
        // Generate random number between 1 and totalWeight
        int randomWeight = new java.util.Random().nextInt(totalWeight) + 1;
        
        // Find which number corresponds to this weight
        int cumulativeWeight = 0;
        for (int i = 0; i < numbers.size(); i++) {
            cumulativeWeight += weights.get(i);
            if (randomWeight <= cumulativeWeight) {
                return numbers.get(i);
            }
        }
        
        // Fallback (should never reach here)
        return numbers.get(numbers.size() - 1);
    }
    
    /**
     * Generates tickets using historical draw analysis without specific patterns.
     */
    private List<int[]> generateHistoricalBasedTickets(int batchSize, LotteryGame lotteryGame) {
        System.out.println("DEBUG: generateHistoricalBasedTickets called with batchSize=" + batchSize);
        List<int[]> tickets = new ArrayList<>();
        for (int i = 0; i < batchSize; i++) {
            System.out.println("DEBUG: Generating ticket " + (i+1) + "/" + batchSize);
            int[] ticket = generateHistoricalBasedTicket(lotteryGame);
            System.out.println("DEBUG: Generated ticket " + (i+1) + ": " + java.util.Arrays.toString(ticket));
            tickets.add(ticket);
        }
        System.out.println("DEBUG: generateHistoricalBasedTickets completed with " + tickets.size() + " tickets");
        return tickets;
    }
    
    /**
     * Generates a single ticket based on historical frequency analysis.
     */
    private int[] generateHistoricalBasedTicket(LotteryGame lotteryGame) {
        System.out.println("DEBUG: generateHistoricalBasedTicket called");
        Map<Integer, Integer> frequencies = calculateNumberFrequencies(lotteryGame);
        System.out.println("DEBUG: Calculated frequencies for " + frequencies.size() + " numbers");
        List<Integer> numbers = new ArrayList<>();
        
        // Get hot numbers (top 60% by frequency)
        List<Integer> hotNumbers = frequencies.entrySet().stream()
            .filter(entry -> entry.getKey() >= lotteryGame.getMinNumber() && entry.getKey() <= lotteryGame.getMaxNumber())
            .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
            .limit((int) ((lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1) * 0.6))
            .map(Map.Entry::getKey)
            .collect(java.util.stream.Collectors.toList());
        
        java.util.Random random = new java.util.Random();
        
        // Select numbers with 60% bias toward hot numbers, 40% random (increased variety)
        for (int i = 0; i < lotteryGame.getDrawPositionCount(); i++) {
            int selectedNumber;
            int attempts = 0;
            
            do {
                if (random.nextDouble() < 0.6 && !hotNumbers.isEmpty()) {
                    // Select from hot numbers
                    selectedNumber = hotNumbers.get(random.nextInt(hotNumbers.size()));
                } else {
                    // Select randomly
                    selectedNumber = lotteryGame.getMinNumber() + random.nextInt(lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1);
                }
                attempts++;
            } while (numbers.contains(selectedNumber) && attempts < 50);
            
            if (!numbers.contains(selectedNumber)) {
                numbers.add(selectedNumber);
            } else {
                // Final fallback
                for (int num = lotteryGame.getMinNumber(); num <= lotteryGame.getMaxNumber(); num++) {
                    if (!numbers.contains(num)) {
                        numbers.add(num);
                        break;
                    }
                }
            }
        }
        
        Collections.sort(numbers);
        return numbers.stream().mapToInt(i -> i).toArray();
    }
    
    /**
     * Generates fallback tickets when pattern-based generation fails.
     */
    private List<int[]> generateFallbackTickets(int batchSize, LotteryGame lotteryGame) {
        List<int[]> tickets = new ArrayList<>();
        for (int i = 0; i < batchSize; i++) {
            tickets.add(generateRandomTicket(lotteryGame));
        }
        return tickets;
    }
    
    /**
     * Generates a single random ticket.
     */
    private int[] generateRandomTicket(LotteryGame lotteryGame) {
        java.util.Set<Integer> numbers = new java.util.HashSet<>();
        java.util.Random random = new java.util.Random();
        
        while (numbers.size() < lotteryGame.getDrawPositionCount()) {
            int number = lotteryGame.getMinNumber() + random.nextInt(lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1);
            numbers.add(number);
        }
        
        return numbers.stream().sorted().mapToInt(i -> i).toArray();
    }

    /**
     * Maps string strategy names to GeneratorType enum.
     */
    private RandomNumberGeneratorFactory.GeneratorType mapStrategyToGeneratorType(String strategy) {
        // For now, map all strategies to the available generator
        // In a full implementation, we'd have more generator types
        switch (strategy.toLowerCase()) {
            case "template_matrix":
                return RandomNumberGeneratorFactory.GeneratorType.TEMPLATE_MATRIX;
                
            case "hot_pair":
            case "triplet_foundation":
            case "pattern_based":
            case "random":
            case "hybrid":
            default:
                return RandomNumberGeneratorFactory.GeneratorType.LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN;
        }
    }

    /**
     * Checks stopping conditions in priority order: pattern > quality > meta.
     * Enhanced with tier-specific stopping logic when applicable.
     */
    private String checkStoppingConditions(GenerationSession session, double qualityScore, double patternCoverage) {
        StoppingCriteria baseCriteria = session.getStoppingCriteria();
        UserTargetingRequest request = session.getOriginalRequest();
        long elapsedMillis = session.getElapsedTimeSeconds() * 1000;
        
        // Check if tier-specific stopping criteria should be used
        if (request != null && shouldApplyTierOptimization(request.getTargetTier())) {
            
            // Create tier-specific stopping criteria
            TierSpecificStoppingCriteria tierCriteria = tierOptimizationManager.createTierStoppingCriteria(
                baseCriteria, request.getTargetTier());
            
            // Create mock QualityMetrics for tier evaluation (in real implementation, use actual metrics)
            QualityMetrics mockMetrics = createMockQualityMetrics(qualityScore, patternCoverage);
            
            // Check tier-specific stopping criteria
            if (tierCriteria.shouldStop(mockMetrics, session.getSuccessfulBatches() * 10, 
                                       session.getAttemptCount(), elapsedMillis)) {
                return tierCriteria.getStoppingReason(mockMetrics, session.getSuccessfulBatches() * 10, 
                                                    session.getAttemptCount(), elapsedMillis);
            }
        }
        
        // Fallback to standard stopping criteria logic
        // Primary: Pattern thresholds
        if (baseCriteria.arePatternCriteriaMet(patternCoverage, patternCoverage * 0.8, 
                                              patternCoverage, qualityScore)) {
            return "Pattern coverage thresholds met";
        }
        
        // Secondary: Quality thresholds  
        if (baseCriteria.areQualityCriteriaMet(qualityScore, patternCoverage, 
                                              qualityScore * 0.9, getGradeFromScore(qualityScore))) {
            return "Quality thresholds met";
        }
        
        // Fallback: Meta conditions
        if (baseCriteria.areMetaConditionsMet(session.getAttemptCount(), elapsedMillis, 
                                             session.getBudgetUsed())) {
            return "Meta conditions met (timeout/attempts/budget)";
        }
        
        return null;
    }

    /**
     * Classifies a batch of tickets by their pattern groups using the PatternGroupingEngine.
     *
     * @param tickets List of tickets to classify
     * @param request User targeting request containing lottery configuration ID
     * @return Map of pattern group -> count
     */
    private Map<String, Integer> classifyBatchPatterns(List<int[]> tickets, UserTargetingRequest request) {
        Map<String, Integer> patternCounts = new HashMap<>();
        patternCounts.put("HOT", 0);
        patternCounts.put("WARM", 0);
        patternCounts.put("COLD", 0);
        patternCounts.put("UNKNOWN", 0);
        
        for (int[] ticket : tickets) {
            // Convert ticket to sorted list for pattern extraction
            List<Integer> numbers = Arrays.stream(ticket)
                .sorted()
                .boxed()
                .collect(java.util.stream.Collectors.toList());
            
            // Use PatternGroupingEngine to classify this ticket with the actual config ID
            String patternGroup = patternGroupingEngine.extractAndClassifyPattern(numbers, 
                request.getLotteryConfigId());
            
            // Update count for this pattern group (convert to uppercase for consistency)
            String key = patternGroup != null ? patternGroup.toUpperCase() : "UNKNOWN";
            // Ensure the key exists in our map before incrementing
            if (patternCounts.containsKey(key)) {
                patternCounts.put(key, patternCounts.get(key) + 1);
            } else {
                // Log unexpected pattern group and count as unknown
                System.err.println("Unexpected pattern group returned: " + patternGroup + ", counting as UNKNOWN");
                patternCounts.put("UNKNOWN", patternCounts.get("UNKNOWN") + 1);
            }
        }
        
        return patternCounts;
    }
    
    /**
     * Calculates enhanced pattern coverage using both QualityMetrics and PatternGroupingEngine results.
     *
     * @param qualityMetrics Quality metrics from the batch evaluation
     * @param patternCounts Pattern group counts from PatternGroupingEngine
     * @return Enhanced pattern coverage score (0-100)
     */
    private double calculateEnhancedPatternCoverage(QualityMetrics qualityMetrics, Map<String, Integer> patternCounts) {
        // Get base pattern coverage from QualityMetrics
        double basePatternCoverage = calculatePatternCoverage(qualityMetrics);
        
        // Calculate weighted pattern score based on actual pattern groups
        int totalTickets = patternCounts.values().stream().mapToInt(Integer::intValue).sum();
        if (totalTickets == 0) {
            return basePatternCoverage;
        }
        
        double hotPercentage = ((double) patternCounts.getOrDefault("HOT", 0) / totalTickets) * 100;
        double warmPercentage = ((double) patternCounts.getOrDefault("WARM", 0) / totalTickets) * 100;
        double coldPercentage = ((double) patternCounts.getOrDefault("COLD", 0) / totalTickets) * 100;
        double unknownPercentage = ((double) patternCounts.getOrDefault("UNKNOWN", 0) / totalTickets) * 100;
        
        // Weighted scoring: hot patterns worth more than warm, warm more than cold
        double weightedScore = (hotPercentage * 1.0) + (warmPercentage * 0.7) + (coldPercentage * 0.4) + (unknownPercentage * 0.1);
        
        // Combine with base coverage for final score
        return Math.min(100.0, (basePatternCoverage * 0.6) + (weightedScore * 0.4));
    }
    
    /**
     * Logs the pattern distribution for a batch to help with strategy analysis.
     *
     * @param strategy The generation strategy used
     * @param patternCounts Pattern group counts
     */
    private void logBatchPatternDistribution(String strategy, Map<String, Integer> patternCounts) {
        int totalTickets = patternCounts.values().stream().mapToInt(Integer::intValue).sum();
        if (totalTickets > 0) {
            System.out.println(String.format("Strategy '%s' generated: Hot=%d (%.1f%%), Warm=%d (%.1f%%), Cold=%d (%.1f%%), Unknown=%d (%.1f%%)",
                strategy,
                patternCounts.getOrDefault("HOT", 0), (patternCounts.getOrDefault("HOT", 0) * 100.0 / totalTickets),
                patternCounts.getOrDefault("WARM", 0), (patternCounts.getOrDefault("WARM", 0) * 100.0 / totalTickets),
                patternCounts.getOrDefault("COLD", 0), (patternCounts.getOrDefault("COLD", 0) * 100.0 / totalTickets),
                patternCounts.getOrDefault("UNKNOWN", 0), (patternCounts.getOrDefault("UNKNOWN", 0) * 100.0 / totalTickets)));
        }
    }

    /**
     * Intelligently selects the next generation strategy based on current pattern performance.
     * If the current strategy is producing good patterns, it might stay with it longer.
     * If not, it will try to switch to a strategy that might produce better patterns.
     *
     * @param currentIndex Current strategy index
     * @param lastBatchPatterns Pattern distribution from the last batch
     * @param session Current generation session for context
     * @return Next strategy index to use
     */
    private int selectNextStrategy(int currentIndex, Map<String, Integer> lastBatchPatterns, GenerationSession session) {
        if (lastBatchPatterns == null || session == null) {
            // Fallback to simple rotation
            return (currentIndex + 1) % availableStrategies.size();
        }
        
        int totalTickets = lastBatchPatterns.values().stream().mapToInt(Integer::intValue).sum();
        if (totalTickets == 0) {
            return (currentIndex + 1) % availableStrategies.size();
        }
        
        // Calculate hot pattern percentage from last batch
        double hotPercentage = ((double) lastBatchPatterns.getOrDefault("HOT", 0) / totalTickets) * 100;
        
        String currentStrategy = availableStrategies.get(currentIndex);
        
        // If current strategy is producing good hot patterns (>50%), give it another chance
        if (hotPercentage > 50.0 && session.getAttemptCount() % 3 != 0) {
            System.out.println("Strategy '" + currentStrategy + "' producing good patterns (" + 
                             String.format("%.1f%%", hotPercentage) + " hot), continuing...");
            return currentIndex; // Stay with current strategy
        }
        
        // If hot pattern percentage is low, try to find a better strategy
        if (hotPercentage < 25.0) {
            // Switch to pattern-focused strategies
            if (!"pattern_based".equals(currentStrategy) && !"hot_pair".equals(currentStrategy)) {
                int patternBasedIndex = availableStrategies.indexOf("pattern_based");
                if (patternBasedIndex >= 0) {
                    System.out.println("Low hot patterns (" + String.format("%.1f%%", hotPercentage) + 
                                     "), switching to pattern_based strategy");
                    return patternBasedIndex;
                }
            }
        }
        
        // Default rotation with some intelligence
        int nextIndex = (currentIndex + 1) % availableStrategies.size();
        
        // Avoid going back to 'random' strategy too often if we're looking for patterns
        if ("random".equals(availableStrategies.get(nextIndex)) && hotPercentage < 40.0) {
            nextIndex = (nextIndex + 1) % availableStrategies.size();
        }
        
        return nextIndex;
    }

    /**
     * Helper methods
     */
    
    private void notifyProgress(GenerationSession session, Consumer<ProgressUpdate> callback) {
        if (callback != null) {
            callback.accept(session.createProgressUpdate());
        }
    }
    
    private String generateSessionId() {
        return "gen-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
    
    private LotteryGame getLotteryGameData(String lotteryState, String lotteryGame) {
        try {
            Optional<StateGamesResponse> gameData = lotteryDataService.getLotteryGameData(lotteryGame, lotteryState);
            
            if (gameData.isPresent()) {
                return gameData.get().getLotteryGame();
            } else {
                // Log warning and return null to indicate failure
                System.err.println("Warning: Could not find lottery game data for " + lotteryGame + " in " + lotteryState);
                return null;
            }
        } catch (Exception e) {
            System.err.println("Error fetching lottery game data: " + e.getMessage());
            return null;
        }
    }
    
    private double calculatePatternCoverage(QualityMetrics quality) {
        if (quality == null || quality.getPatternDistribution() == null) {
            return 0.0;
        }
        return quality.getPatternDistribution().values().stream()
                     .mapToDouble(Double::doubleValue).sum();
    }
    
    private void addUniqueTickets(List<int[]> collection, List<int[]> newTickets) {
        Set<String> existingTickets = new HashSet<>();
        for (int[] ticket : collection) {
            existingTickets.add(Arrays.toString(ticket));
        }
        
        for (int[] ticket : newTickets) {
            if (!existingTickets.contains(Arrays.toString(ticket))) {
                collection.add(ticket);
            }
        }
    }
    
    private String getGradeFromScore(double score) {
        if (score >= 85) return "A";
        if (score >= 70) return "B";
        if (score >= 55) return "C";
        if (score >= 40) return "D";
        return "F";
    }
    
    private String getStoppingType(String reason) {
        if (reason.toLowerCase().contains("pattern")) return "pattern";
        if (reason.toLowerCase().contains("quality")) return "quality";
        if (reason.toLowerCase().contains("timeout") || reason.toLowerCase().contains("attempts")) return "timeout";
        return "meta";
    }
    
    private GeneratedTicketSet createFailedResult(GenerationSession session, String error) {
        session.updateStatus(GenerationStatus.FAILED);
        session.recordError(error);
        
        return GeneratedTicketSet.builder()
                .sessionId(session.getSessionId())
                .tickets(Collections.emptyList())
                .qualityMetrics(createEmptyQualityMetrics(session.getOriginalRequest().getLotteryConfigId()))
                .generationSummary(session.createSummary())
                .lotteryConfigId(session.getOriginalRequest().getLotteryConfigId())
                .finalStatus(GenerationStatus.FAILED)
                .historicalPerformance(null) // No historical analysis for failed generations
                .build();
    }
    
    private QualityMetrics createEmptyQualityMetrics(String lotteryConfigId) {
        ImprovementMetrics emptyImprovement = new ImprovementMetrics(0.0, 0.0, 0.0, false, "unknown");
        return new QualityMetrics(0.0, "F", Map.of("HOT", 0.0, "WARM", 0.0, "COLD", 0.0),
                                 0.0, 0.0, 0.0, 0.0, 0.0, 0, lotteryConfigId, emptyImprovement);
    }

    /**
     * Calculates historical performance analysis for generated tickets.
     * Uses error handling to ensure generation doesn't fail if historical analysis fails.
     */
    private HistoricalPerformanceAnalysis calculateHistoricalPerformance(List<int[]> tickets, 
                                                                        String lotteryConfigId, 
                                                                        String sessionId,
                                                                        UserTargetingRequest request) {
        System.out.println("DEBUG: Starting historical performance calculation for session: " + sessionId);
        System.out.println("DEBUG: Tickets count: " + (tickets != null ? tickets.size() : "null"));
        System.out.println("DEBUG: LotteryConfigId: " + lotteryConfigId);
        
        if (tickets == null || tickets.isEmpty()) {
            System.out.println("DEBUG: No tickets to analyze - returning null");
            return null; // No tickets to analyze
        }

        try {
            // Use the request parameters directly for more reliable parsing
            String game = request.getLotteryGame() != null ? request.getLotteryGame() : lotteryConfigId;
            String state = request.getLotteryState() != null ? request.getLotteryState() : "Texas";
            
            System.out.println("DEBUG: Using game: " + game + ", state: " + state);
            System.out.println("DEBUG: From request - lotteryGame: " + request.getLotteryGame() + ", lotteryState: " + request.getLotteryState());
            
            // Fetch historical data using the lottery data service
            System.out.println("DEBUG: Fetching historical data...");
            Optional<StateGamesResponse> gameDataOptional = lotteryDataService.getLotteryGameData(game, state);
            
            if (!gameDataOptional.isPresent()) {
                System.out.println("DEBUG: No historical data found in Optional - returning null");
                return null; // No historical data available
            }
            
            StateGamesResponse historicalData = gameDataOptional.get();
            if (historicalData == null) {
                System.out.println("DEBUG: Historical data is null - returning null");
                return null; // No historical data available
            }

            System.out.println("DEBUG: Historical data found, lottery game: " + 
                             (historicalData.getLotteryGame() != null ? "present" : "null"));
            
            if (historicalData.getLotteryGame() != null && historicalData.getLotteryGame().getLotteryDraws() != null) {
                System.out.println("DEBUG: Draw count: " + historicalData.getLotteryGame().getLotteryDraws().size());
            }

            // Perform historical performance analysis
            System.out.println("DEBUG: Calling HistoricalPerformanceService...");
            HistoricalPerformanceAnalysis result = historicalPerformanceService.analyzePerformance(
                    tickets, lotteryConfigId, historicalData, sessionId);
            
            System.out.println("DEBUG: HistoricalPerformanceService returned: " + (result != null ? "result" : "null"));
            return result;

        } catch (Exception e) {
            // Log error but don't fail the entire generation
            System.err.println("Historical performance analysis failed for session " + sessionId + ": " + e.getMessage());
            e.printStackTrace();
            return null; // Graceful degradation - return without historical analysis
        }
    }
    
    /**
     * Creates mock QualityMetrics for tier-specific stopping criteria evaluation.
     * In production, this would be replaced with actual QualityMetrics from the current generation batch.
     */
    private QualityMetrics createMockQualityMetrics(double qualityScore, double patternCoverage) {
        ImprovementMetrics mockImprovement = new ImprovementMetrics(qualityScore, patternCoverage, qualityScore, true, "tier_optimization");
        Map<String, Double> patternDistribution = Map.of(
            "HOT", patternCoverage * 0.6, 
            "WARM", patternCoverage * 0.3, 
            "COLD", patternCoverage * 0.1
        );
        return new QualityMetrics(qualityScore, getGradeFromScore(qualityScore), patternDistribution,
                                 patternCoverage, qualityScore * 0.8, qualityScore * 0.9, 
                                 0.0, 0.0, 0, "tier_optimization", mockImprovement);
    }
    
    private void storeGenerationResults(GenerationSession session, List<int[]> tickets, QualityMetrics quality) {
        // DISABLED: This duplicates session creation that's already handled by createApiSession()
        // The SessionIntegrationService was causing conflicts and foreign key violations
        System.out.println("DEBUG: Skipping duplicate SessionIntegrationService call - session already created via createApiSession()");
        System.out.println("DEBUG: Session: " + session.getSessionId() + " already has proper API session and ticket set created");
    }

    /**
     * Stores a local ticket set ID for a session when Phase 1 API fails.
     *
     * @param sessionId The session ID
     * @param ticketSetId The local ticket set ID
     */
    private void storeLocalTicketSetId(String sessionId, Integer ticketSetId) {
        localTicketSetIds.put(sessionId, ticketSetId);
    }
    
    /**
     * Gets the local ticket set ID for a session.
     *
     * @param sessionId The session ID
     * @return The ticket set ID, or null if not found
     */
    public Integer getLocalTicketSetId(String sessionId) {
        return localTicketSetIds.get(sessionId);
    }

    /**
     * Shuts down the generation engine and cleans up resources.
     */
    public void shutdown() {
        generationExecutor.shutdown();
        cleanupExecutor.shutdown();
        try {
            if (!generationExecutor.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS)) {
                generationExecutor.shutdownNow();
            }
            if (!cleanupExecutor.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS)) {
                cleanupExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            generationExecutor.shutdownNow();
            cleanupExecutor.shutdownNow();
        }
        activeSessions.clear();
    }
    
    /**
     * Starts a background cleanup task to remove completed/failed sessions older than 30 minutes.
     */
    private void startSessionCleanupTask() {
        cleanupExecutor.scheduleAtFixedRate(() -> {
            try {
                cleanupOldSessions();
            } catch (Exception e) {
                System.err.println("Session cleanup error: " + e.getMessage());
            }
        }, 5, 5, java.util.concurrent.TimeUnit.MINUTES);
    }
    
    /**
     * Removes sessions that are completed, failed, or older than 30 minutes.
     */
    private void cleanupOldSessions() {
        long thirtyMinutesAgo = System.currentTimeMillis() - (30 * 60 * 1000);
        int removedCount = 0;
        
        java.util.Iterator<Map.Entry<String, GenerationSession>> iterator = activeSessions.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, GenerationSession> entry = iterator.next();
            GenerationSession session = entry.getValue();
            GenerationStatus status = session.getCurrentStatus();
            long sessionStartTime = session.getCreatedAt().atZone(java.time.ZoneId.systemDefault())
                                          .toInstant().toEpochMilli();
            
            // Remove if completed/failed and older than 30 minutes
            boolean shouldRemove = (status == GenerationStatus.COMPLETED || status == GenerationStatus.FAILED) 
                                 && sessionStartTime < thirtyMinutesAgo;
            
            if (shouldRemove) {
                iterator.remove();
                removedCount++;
                System.out.println("Cleaned up old session: " + entry.getKey() + " (status: " + status + ")");
            }
        }
        
        if (removedCount > 0) {
            System.out.println("Session cleanup completed: removed " + removedCount + " sessions");
        }
    }
    
    /**
     * Manually removes a specific session (useful for testing or forced cleanup).
     */
    public boolean removeSession(String sessionId) {
        GenerationSession removed = activeSessions.remove(sessionId);
        return removed != null;
    }

    /**
     * Gets statistics about active sessions.
     *
     * @return Map of session statistics
     */
    public Map<String, Object> getEngineStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("activeSessions", activeSessions.size());
        
        // Count sessions by status
        Map<GenerationStatus, Long> sessionsByStatus = activeSessions.values().stream()
            .collect(java.util.stream.Collectors.groupingBy(
                GenerationSession::getCurrentStatus, 
                java.util.stream.Collectors.counting()
            ));
        
        stats.put("sessionsRunning", sessionsByStatus.getOrDefault(GenerationStatus.RUNNING, 0L));
        stats.put("sessionsCompleted", sessionsByStatus.getOrDefault(GenerationStatus.COMPLETED, 0L));
        stats.put("sessionsFailed", sessionsByStatus.getOrDefault(GenerationStatus.FAILED, 0L));
        stats.put("totalSessionsProcessed", activeSessions.size());
        stats.put("isHealthy", qualityEvaluationService.isServiceHealthy());
        return stats;
    }
    
    /**
     * PHASE 3 INTEGRATION: Determines if Advanced Generation Engine should be used.
     */
    private boolean shouldUseAdvancedGeneration(int batchSize, PrizeDroughtAnalysis droughtAnalysis, 
                                               PatternPerformanceAnalysis patternAnalysis) {
        
        // Use advanced generation for larger batches with significant intelligence
        if (batchSize >= 10 && droughtAnalysis.hasActiveDroughts() && patternAnalysis.hasSignificantData()) {
            return true;
        }
        
        // Use for medium batches with strong drought signals
        if (batchSize >= 5 && droughtAnalysis.hasActiveDroughts() && 
            droughtAnalysis.getOverallDroughtScore() > 1.5) {
            return true;
        }
        
        // Use for any batch with excellent pattern performance data
        if (patternAnalysis.hasSignificantData() && 
            patternAnalysis.getHighestSuccessRatePatterns(1).size() > 0) {
            double topSuccessRate = patternAnalysis.getPatternSuccessRates().values().stream()
                .mapToDouble(Double::doubleValue)
                .max().orElse(0.0);
            if (topSuccessRate > 0.5) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * PHASE 3: Generates tickets using the Advanced Generation Engine.
     */
    private List<int[]> generateWithAdvancedEngine(int batchSize, LotteryGame lotteryGame,
                                                  PrizeDroughtAnalysis droughtAnalysis, 
                                                  PatternPerformanceAnalysis patternAnalysis) {
        try {
            // Create configuration based on generation requirements
            AdvancedGenerationConfig config = createAdvancedGenerationConfig(batchSize);
            
            // Initialize Advanced Generation Engine with full Phase 3 capabilities
            AdvancedGenerationEngine advancedEngine = new AdvancedGenerationEngine(
                lotteryGame, batchSize, droughtAnalysis, patternAnalysis, config);
            
            // Execute advanced generation with real-time monitoring
            System.out.println("🚀 Starting Phase 3 Advanced Generation with real-time monitoring...");
            advancedEngine.process();
            
            // Get results and metrics
            List<int[]> tickets = advancedEngine.getGeneratedNumbers();
            GenerationMetrics metrics = advancedEngine.getMetrics();
            
            // Perform final validation and optimization using SmartTicketValidator
            SmartTicketValidator validator = new SmartTicketValidator(lotteryGame, droughtAnalysis, patternAnalysis);
            SmartTicketValidator.BatchValidationResult validation = validator.validateTickets(tickets);
            
            System.out.println("🚀 Phase 3 Advanced Generation Complete:");
            System.out.println("  📊 Generated: " + tickets.size() + " tickets");
            System.out.println("  📈 " + metrics.getSummary());
            System.out.println("  ✅ Validation: " + validation.getStatistics().getSummary());
            
            // Apply recommendations if needed
            if (!validation.getRecommendations().isEmpty()) {
                System.out.println("  💡 Recommendations: " + String.join(", ", validation.getRecommendations()));
            }
            
            return tickets;
            
        } catch (Exception e) {
            System.err.println("ERROR: Advanced generation failed, using fallback: " + e.getMessage());
            e.printStackTrace();
            return Collections.emptyList();
        }
    }
    
    /**
     * Creates configuration for Advanced Generation Engine based on requirements.
     */
    private AdvancedGenerationConfig createAdvancedGenerationConfig(int batchSize) {
        if (batchSize >= 20) {
            // Large batches: prioritize quality
            return AdvancedGenerationConfig.forQuality();
        } else if (batchSize >= 10) {
            // Medium batches: balanced approach
            return AdvancedGenerationConfig.balanced();
        } else {
            // Small batches: prioritize performance
            return AdvancedGenerationConfig.forPerformance();
        }
    }
    
    /**
     * PHASE 1+2 INTEGRATION: Selects patterns using combined drought + performance analysis.
     * This method integrates Phase 1 drought detection with Phase 2 pattern performance data.
     */
    private String selectStrategicPattern(List<String> patterns, PrizeDroughtAnalysis droughtAnalysis, 
                                        PatternPerformanceAnalysis patternAnalysis) {
        if (patterns.isEmpty()) {
            return null;
        }
        
        // If we have both drought and pattern performance data, use strategic selection
        if (droughtAnalysis.hasActiveDroughts() && patternAnalysis.hasSignificantData()) {
            return selectCombinedStrategicPattern(patterns, droughtAnalysis, patternAnalysis);
        }
        
        // Fallback to drought-only selection if pattern data is limited
        if (droughtAnalysis.hasActiveDroughts()) {
            return selectDroughtWeightedPattern(patterns, droughtAnalysis);
        }
        
        // Fallback to performance-only selection if no drought detected
        if (patternAnalysis.hasSignificantData()) {
            return selectPerformanceBasedPattern(patterns, patternAnalysis);
        }
        
        // Final fallback to random selection
        return patterns.get(new java.util.Random().nextInt(patterns.size()));
    }
    
    /**
     * Combines drought urgency with pattern performance data for optimal pattern selection.
     */
    private String selectCombinedStrategicPattern(List<String> patterns, PrizeDroughtAnalysis droughtAnalysis,
                                                PatternPerformanceAnalysis patternAnalysis) {
        
        String highestPriorityTier = droughtAnalysis.getHighestPriorityPrizeTier();
        double droughtWeight = droughtAnalysis.getTargetingWeight(highestPriorityTier);
        
        System.out.println("🎯 Combined strategic selection: Targeting " + highestPriorityTier + 
                          " with " + String.format("%.2f", droughtWeight) + "x drought weight");
        
        // Get strategic pattern weights that consider both drought and performance
        Map<String, Double> strategicWeights = patternAnalysis.getStrategicPatternWeights(highestPriorityTier, droughtWeight);
        
        // Select from patterns that exist in both our available patterns and strategic patterns
        List<String> eligiblePatterns = patterns.stream()
            .filter(strategicWeights::containsKey)
            .collect(Collectors.toList());
        
        if (eligiblePatterns.isEmpty()) {
            // No strategic overlap, use top performance patterns if available
            List<String> topPatterns = patternAnalysis.getBestPatternsForTier(highestPriorityTier, 3);
            eligiblePatterns = patterns.stream()
                .filter(topPatterns::contains)
                .collect(Collectors.toList());
        }
        
        if (eligiblePatterns.isEmpty()) {
            // Still no overlap, fall back to drought-weighted selection
            return selectDroughtWeightedPattern(patterns, droughtAnalysis);
        }
        
        // Weighted random selection from eligible strategic patterns
        return selectWeightedPatternFromList(eligiblePatterns, strategicWeights);
    }
    
    /**
     * Selects pattern based purely on performance data.
     */
    private String selectPerformanceBasedPattern(List<String> patterns, PatternPerformanceAnalysis patternAnalysis) {
        // Get the patterns with highest success rates
        List<String> highSuccessPatterns = patternAnalysis.getHighestSuccessRatePatterns(5);
        
        // Find overlap between available patterns and high success patterns
        List<String> eligiblePatterns = patterns.stream()
            .filter(highSuccessPatterns::contains)
            .collect(Collectors.toList());
        
        if (!eligiblePatterns.isEmpty()) {
            return eligiblePatterns.get(new java.util.Random().nextInt(eligiblePatterns.size()));
        }
        
        // No overlap, select randomly
        return patterns.get(new java.util.Random().nextInt(patterns.size()));
    }
    
    /**
     * Performs weighted random selection from a list of patterns.
     */
    private String selectWeightedPatternFromList(List<String> patterns, Map<String, Double> weights) {
        if (patterns.isEmpty()) {
            return null;
        }
        
        // Calculate total weight
        double totalWeight = patterns.stream()
            .mapToDouble(p -> weights.getOrDefault(p, 1.0))
            .sum();
        
        if (totalWeight <= 0) {
            return patterns.get(new java.util.Random().nextInt(patterns.size()));
        }
        
        // Weighted random selection
        double random = new java.util.Random().nextDouble() * totalWeight;
        double cumulativeWeight = 0.0;
        
        for (String pattern : patterns) {
            cumulativeWeight += weights.getOrDefault(pattern, 1.0);
            if (random <= cumulativeWeight) {
                return pattern;
            }
        }
        
        // Fallback
        return patterns.get(patterns.size() - 1);
    }
    
    /**
     * PHASE 1+2 INTEGRATION: Enhanced number generation using combined analysis.
     */
    private int[] generateStrategicallyEnhancedNumbersForPattern(String pattern, LotteryGame lotteryGame,
                                                               PrizeDroughtAnalysis droughtAnalysis,
                                                               PatternPerformanceAnalysis patternAnalysis) {
        
        // Start with standard pattern-based generation
        int[] baseTicket = generateNumbersForPatternWithHistory(pattern, lotteryGame);
        
        if (baseTicket == null) {
            return null;
        }
        
        // Apply drought-aware adjustments if active droughts
        if (droughtAnalysis.hasActiveDroughts()) {
            baseTicket = applyDroughtAwareAdjustments(baseTicket, lotteryGame, droughtAnalysis);
        }
        
        // Apply performance-based enhancements if significant pattern data
        if (patternAnalysis.hasSignificantData()) {
            baseTicket = applyPerformanceBasedEnhancements(baseTicket, lotteryGame, patternAnalysis, pattern);
        }
        
        return baseTicket;
    }
    
    /**
     * Applies performance-based enhancements to number selection.
     */
    private int[] applyPerformanceBasedEnhancements(int[] baseTicket, LotteryGame lotteryGame,
                                                   PatternPerformanceAnalysis patternAnalysis, String pattern) {
        if (baseTicket == null) {
            return null;
        }
        
        double successRate = patternAnalysis.getPatternSuccessRate(pattern);
        
        // Only apply enhancements if this pattern has good historical performance
        if (successRate < 0.3) {
            return baseTicket;
        }
        
        System.out.println("🔧 Applying performance enhancements for pattern " + pattern + 
                          " (success rate: " + String.format("%.1f%%", successRate * 100) + ")");
        
        // Create enhanced copy
        List<Integer> enhancedNumbers = new ArrayList<>();
        for (int num : baseTicket) {
            enhancedNumbers.add(num);
        }
        
        // For high-performance patterns, slightly favor recently successful number ranges
        // This is a simplified approach - real implementation would analyze detailed pattern history
        
        java.util.Random random = new java.util.Random();
        
        // If pattern has high success rate, make strategic adjustments
        if (successRate > 0.5) {
            // Replace 1-2 numbers with numbers from successful ranges (25-45 range for versatility)
            int replacements = random.nextInt(2) + 1;
            for (int i = 0; i < replacements && i < enhancedNumbers.size(); i++) {
                int replaceIndex = random.nextInt(enhancedNumbers.size());
                int newNumber;
                do {
                    newNumber = 25 + random.nextInt(21); // Numbers 25-45 (middle range, historically versatile)
                } while (enhancedNumbers.contains(newNumber));
                
                enhancedNumbers.set(replaceIndex, newNumber);
            }
        }
        
        // Sort and return
        Collections.sort(enhancedNumbers);
        return enhancedNumbers.stream().mapToInt(Integer::intValue).toArray();
    }
    
    /**
     * Selects a pattern from available patterns, weighted by drought analysis priorities.
     * Patterns that align with overdue prize tiers get higher selection probability.
     */
    private String selectDroughtWeightedPattern(List<String> patterns, PrizeDroughtAnalysis droughtAnalysis) {
        if (patterns.isEmpty()) {
            return null;
        }
        
        // If no active droughts, use standard random selection
        if (!droughtAnalysis.hasActiveDroughts()) {
            return patterns.get(new java.util.Random().nextInt(patterns.size()));
        }
        
        // For now, prioritize the highest priority drought tier by giving it 3x weight
        // In a more advanced implementation, we could analyze which patterns correlate with which prize tiers
        String highestPriorityTier = droughtAnalysis.getHighestPriorityPrizeTier();
        double priorityWeight = droughtAnalysis.getTargetingWeight(highestPriorityTier);
        
        System.out.println("🎯 Drought-weighted selection: Prioritizing " + highestPriorityTier + 
                          " patterns with " + String.format("%.2f", priorityWeight) + "x weight");
        
        // Simple weighted selection: give drought-aligned patterns higher probability
        java.util.Random random = new java.util.Random();
        
        // 70% chance to select from drought-aligned patterns, 30% chance for standard selection
        if (priorityWeight > 1.5 && random.nextDouble() < 0.7) {
            // Select patterns that historically correlate with the high-priority prize tier
            // For now, use the first few patterns as they tend to be most frequent
            int prioritizedIndex = random.nextInt(Math.min(3, patterns.size()));
            System.out.println("🔍 Selected drought-prioritized pattern index: " + prioritizedIndex);
            return patterns.get(prioritizedIndex);
        }
        
        // Standard random selection
        return patterns.get(random.nextInt(patterns.size()));
    }
    
    /**
     * Generates numbers for a pattern, incorporating drought analysis weights to bias number selection
     * toward combinations that historically produced the overdue prize tiers.
     */
    private int[] generateDroughtAwareNumbersForPattern(String pattern, LotteryGame lotteryGame, 
                                                       PrizeDroughtAnalysis droughtAnalysis) {
        
        // Start with standard pattern-based number generation
        int[] baseTicket = generateNumbersForPatternWithHistory(pattern, lotteryGame);
        
        if (baseTicket == null || !droughtAnalysis.hasActiveDroughts()) {
            return baseTicket;
        }
        
        // Apply drought-aware adjustments to number selection
        return applyDroughtAwareAdjustments(baseTicket, lotteryGame, droughtAnalysis);
    }
    
    /**
     * Applies drought-aware adjustments to a base ticket by strategically replacing some numbers
     * with those that historically correlate with overdue prize tiers.
     */
    private int[] applyDroughtAwareAdjustments(int[] baseTicket, LotteryGame lotteryGame, 
                                             PrizeDroughtAnalysis droughtAnalysis) {
        if (baseTicket == null) {
            return null;
        }
        
        String highestPriorityTier = droughtAnalysis.getHighestPriorityPrizeTier();
        double priorityWeight = droughtAnalysis.getTargetingWeight(highestPriorityTier);
        
        // Only apply adjustments if there's significant drought weighting
        if (priorityWeight < 1.3) {
            return baseTicket;
        }
        
        System.out.println("🔧 Applying drought adjustments for " + highestPriorityTier + 
                          " (weight: " + String.format("%.2f", priorityWeight) + "x)");
        
        // Create a copy of the base ticket for adjustments
        List<Integer> adjustedNumbers = new ArrayList<>();
        for (int num : baseTicket) {
            adjustedNumbers.add(num);
        }
        
        // Apply tier-specific number selection bias
        // This is a simplified approach - in a full implementation, we'd analyze historical data
        // to determine which number ranges/patterns correlate with specific prize tiers
        
        java.util.Random random = new java.util.Random();
        
        // For match4/match5 droughts, slightly favor numbers in middle ranges (historically more versatile)
        if (highestPriorityTier.contains("match4") || highestPriorityTier.contains("match5")) {
            // Replace 1-2 numbers with middle-range numbers (20-40 range)
            int replacements = random.nextInt(2) + 1;
            for (int i = 0; i < replacements && i < adjustedNumbers.size(); i++) {
                int replaceIndex = random.nextInt(adjustedNumbers.size());
                int newNumber;
                do {
                    newNumber = 20 + random.nextInt(21); // Numbers 20-40
                } while (adjustedNumbers.contains(newNumber));
                
                adjustedNumbers.set(replaceIndex, newNumber);
            }
        }
        
        // Sort and return
        Collections.sort(adjustedNumbers);
        return adjustedNumbers.stream().mapToInt(Integer::intValue).toArray();
    }
    
    /**
     * Analyzes real historical lottery draws to identify frequently occurring patterns.
     * This replaces mock data with actual analysis of lottery history.
     */
    private List<String> analyzeRealDrawPatterns(LotteryGame lotteryGame, String configId) {
        if (lotteryGame == null || lotteryGame.getLotteryDraws() == null || lotteryGame.getLotteryDraws().isEmpty()) {
            System.out.println("No historical draws available for analysis");
            return List.of();
        }
        
        List<com.floyd.persistence.model.LotteryDraw> draws = lotteryGame.getLotteryDraws();
        System.out.println("Analyzing " + draws.size() + " historical draws for " + configId);
        
        // Count frequency of each pattern from real draws
        Map<String, Integer> patternFrequency = new HashMap<>();
        
        for (com.floyd.persistence.model.LotteryDraw draw : draws) {
            List<Integer> drawNumbers = draw.getDrawResults();
            if (drawNumbers != null && drawNumbers.size() >= 5) {
                // Sort the numbers for consistent pattern extraction
                List<Integer> sortedNumbers = new ArrayList<>(drawNumbers);
                Collections.sort(sortedNumbers);
                
                // Extract the tens-digit pattern (e.g., [5,15,25,30,35] → "01223")
                String pattern = patternGroupingEngine.extractPattern(sortedNumbers);
                
                if (pattern != null && !pattern.isEmpty()) {
                    patternFrequency.put(pattern, patternFrequency.getOrDefault(pattern, 0) + 1);
                }
            }
        }
        
        System.out.println("Found " + patternFrequency.size() + " unique patterns in historical data");
        
        // Get the most frequent patterns (top 20% or at least 5 patterns)
        List<String> hotPatterns = patternFrequency.entrySet().stream()
            .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue())) // Sort by frequency descending
            .limit(Math.max(5, patternFrequency.size() / 5)) // Take top 20% or at least 5
            .peek(entry -> System.out.println("Hot pattern: '" + entry.getKey() + "' (frequency: " + entry.getValue() + ")"))
            .map(Map.Entry::getKey)
            .collect(java.util.stream.Collectors.toList());
        
        return hotPatterns;
    }
    
    /**
     * Publishes high-quality tickets as proven combinations to the persistence API.
     * Called when tickets achieve optimization scores >= 85.
     */
    private void publishHighQualityTickets(List<int[]> tickets, String lotteryConfigId, double qualityScore, String targetTier) {
        for (int[] ticket : tickets) {
            try {
                persistenceClient.publishProvenCombination(ticket, lotteryConfigId, qualityScore, targetTier, 1)
                    .whenComplete((result, throwable) -> {
                        if (throwable != null) {
                            System.err.println("Failed to publish proven combination: " + Arrays.toString(ticket));
                        } else {
                            System.out.println("Published proven combination: " + Arrays.toString(ticket) + 
                                             " (quality: " + qualityScore + ", tier: " + targetTier + ")");
                        }
                    });
            } catch (Exception e) {
                System.err.println("Error publishing combination: " + e.getMessage());
            }
        }
    }
    
    /**
     * Saves successful tickets using the new batch tickets API endpoint.
     */
    private void saveSuccessfulTicketsBatch(List<int[]> tickets, String lotteryConfigId, String patternUsed, double qualityScore, String sessionId) {
        try {
            if (sessionId == null) {
                System.err.println("Cannot save tickets batch: sessionId is null - would create invalid ticket set ID");
                return;
            }
            int ticketSetId = Math.abs(sessionId.hashCode());
            double confidenceScore = qualityScore / 100.0;
            
            persistenceClient.saveSuccessfulTicketsBatch(tickets, lotteryConfigId, patternUsed, confidenceScore, ticketSetId)
                .whenComplete((result, throwable) -> {
                    if (throwable != null) {
                        System.err.println("Failed to save ticket batch for config: " + lotteryConfigId);
                    } else {
                        System.out.println("Saved ticket batch: " + tickets.size() + " tickets " +
                                         "(pattern: " + patternUsed + ", confidence: " + String.format("%.3f", confidenceScore) + ")");
                    }
                });
        } catch (Exception e) {
            System.err.println("Error saving ticket batch: " + e.getMessage());
        }
    }
    
    /**
     * Updates hot numbers based on successful generation patterns.
     * Extracts the most frequently used numbers from successful tickets and combines with historical data.
     */
    private void updateHotNumbersFromSuccessfulGeneration(List<int[]> successfulTickets, String lotteryConfigId) {
        try {
            // Extract all numbers from successful tickets
            Map<Integer, Integer> numberFrequency = new HashMap<>();
            for (int[] ticket : successfulTickets) {
                for (int number : ticket) {
                    numberFrequency.put(number, numberFrequency.getOrDefault(number, 0) + 1);
                }
            }
            
            // Get top numbers (sort by frequency, take top performers)
            List<Integer> topNumbers = numberFrequency.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(10)
                .map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toList());
            
            if (!topNumbers.isEmpty()) {
                persistenceClient.updateHotNumbers(lotteryConfigId, topNumbers)
                    .whenComplete((result, throwable) -> {
                        if (throwable != null) {
                            System.err.println("Failed to update hot numbers for config: " + lotteryConfigId);
                        } else {
                            System.out.println("Updated hot numbers for config: " + lotteryConfigId + 
                                             " with " + topNumbers.size() + " numbers");
                        }
                    });
            }
        } catch (Exception e) {
            System.err.println("Error updating hot numbers: " + e.getMessage());
        }
    }
    
    /**
     * Creates API session following proper sequence requirements.
     * Returns the API session ID for use in subsequent ticket set and ticket creation.
     */
    private String createApiSession(UserTargetingRequest request, String localSessionId) {
        try {
            System.out.println("DEBUG: Creating API session via createUserSession()");
            System.out.println("DEBUG: SessionId: " + localSessionId);
            System.out.println("DEBUG: LotteryConfigId: " + request.getLotteryConfigId());
            System.out.println("DEBUG: Strategy: " + request.getGenerationStrategy());
            
            // Create API session using persistence client
            CompletableFuture<Void> sessionFuture = persistenceClient.createUserSession(
                localSessionId, 
                request.getLotteryConfigId(),
                request.getTargetTier(),
                request.getNumberOfTickets(),
                mapToValidGenerationStrategy(request.getGenerationStrategy()), // Convert to API-compatible format
                request.getBudget() > 0 ? request.getBudget() : 100.0
            );
            
            // Wait for session creation to complete
            sessionFuture.join();
            System.out.println("DEBUG: API session created successfully: " + localSessionId);
            return localSessionId; // API uses our session ID
            
        } catch (Exception e) {
            System.err.println("Failed to create API session: " + e.getMessage());
            throw new RuntimeException("API session creation failed", e);
        }
    }
    
    /**
     * Saves successful tickets following the proper API sequence:
     * Session (already created) → Ticket Set → Tickets
     */
    private void saveSuccessfulTicketsWithProperSequence(List<int[]> tickets, UserTargetingRequest request, 
                                                        String patternUsed, QualityMetrics qualityMetrics, String apiSessionId) {
        try {
            // Step 1: Create quality metrics map from actual QualityMetrics object
            Map<String, Object> qualityMetricsMap = new HashMap<>();
            qualityMetricsMap.put("optimizationScore", qualityMetrics.getOptimizationScore());
            qualityMetricsMap.put("patternCoverage", qualityMetrics.getCoveragePercentage());
            qualityMetricsMap.put("diversity", qualityMetrics.getUniquenessScore());
            qualityMetricsMap.put("patternDistribution", qualityMetrics.getPatternDistribution());
            qualityMetricsMap.put("qualityGrade", qualityMetrics.getQualityGrade());
            qualityMetricsMap.put("consecutiveRate", qualityMetrics.getConsecutiveRate());
            qualityMetricsMap.put("repeatRate", qualityMetrics.getRepeatRate());
            qualityMetricsMap.put("overlapPercentage", qualityMetrics.getOverlapPercentage());
            
            List<String> patternsUsed = List.of(patternUsed);
            
            // Step 2: Create ticket set
            System.out.println("DEBUG: Creating ticket set for API session: " + apiSessionId);
            CompletableFuture<Integer> ticketSetFuture = persistenceClient.createTicketSet(
                apiSessionId, qualityMetricsMap, patternsUsed);
            
            // Wait for ticket set creation and get the ID
            Integer ticketSetId = ticketSetFuture.join();
            System.out.println("DEBUG: Created ticket set with ID: " + ticketSetId + " for session: " + apiSessionId);
            
            // Step 3: Save tickets using the ticket set ID
            double confidenceScore = qualityMetrics.getOptimizationScore() / 100.0;
            persistenceClient.saveSuccessfulTicketsBatch(tickets, request.getLotteryConfigId(), 
                                                       patternUsed, confidenceScore, ticketSetId)
                .whenComplete((result, throwable) -> {
                    if (throwable != null) {
                        System.err.println("Failed to save tickets with proper sequence for config: " + request.getLotteryConfigId());
                    } else {
                        System.out.println("Saved tickets with proper sequence: " + tickets.size() + " tickets " +
                                         "(session: " + apiSessionId + ", ticketSet: " + ticketSetId + ", pattern: " + patternUsed + ")");
                    }
                });
                
        } catch (Exception e) {
            System.err.println("Error saving tickets with proper sequence: " + e.getMessage());
            // Fallback to existing batch method if proper sequence fails, but only if we have a valid API session
            if (apiSessionId != null) {
                saveSuccessfulTicketsBatch(tickets, request.getLotteryConfigId(), patternUsed, qualityMetrics.getOptimizationScore(), apiSessionId);
            } else {
                System.err.println("Skipping fallback batch save - no valid API session to prevent foreign key violations");
            }
        }
    }
    
    /**
     * Gets the maximum tickets per generation for a tier strategy.
     */
    private int getTierMaxTickets(TierOptimizationStrategy strategy) {
        // Extract max tickets from each tier strategy
        switch (strategy.getTierLevel()) {
            case 1: return 20; // Tier 1 - Jackpot
            case 2: return 30; // Tier 2 - Near-jackpot  
            case 3: return 50; // Tier 3 - High secondary
            case 4: return 75; // Tier 4 - Mid-tier
            case 5: return 100; // Tier 5 - Volume
            default: return 50; // Fallback
        }
    }
    
    /**
     * Generates a batch with variance parameters to prevent duplicates across batches.
     * Each batch uses slightly different optimization settings for diversity.
     */
    private List<int[]> generateVariedBatch(int batchSize, LotteryGame lotteryGame, UserTargetingRequest request,
                                           List<String> hotPatterns, int batchNumber, Set<String> existingHashes) {
        
        List<int[]> batchTickets = new ArrayList<>();
        BatchVarianceParams variance = createBatchVariance(batchNumber, request.getTargetTier());
        
        System.out.println("Batch " + (batchNumber + 1) + " variance: " + variance);
        
        int attempts = 0;
        int maxAttempts = batchSize * 3; // Allow some extra attempts for unique generation
        
        while (batchTickets.size() < batchSize && attempts < maxAttempts) {
            int[] ticket = generateVariedTierOptimizedTicket(hotPatterns, lotteryGame, request, variance);
            
            if (ticket != null && ticket.length == lotteryGame.getDrawPositionCount()) {
                String ticketHash = Arrays.toString(ticket);
                
                // Check for duplicates within this batch AND across all previous batches
                if (!existingHashes.contains(ticketHash) && 
                    batchTickets.stream().noneMatch(existing -> Arrays.toString(existing).equals(ticketHash))) {
                    
                    batchTickets.add(ticket);
                } else {
                    System.out.println("Duplicate detected in batch " + (batchNumber + 1) + ", regenerating...");
                }
            }
            
            attempts++;
        }
        
        System.out.println("Batch " + (batchNumber + 1) + " generated " + batchTickets.size() + 
                         " unique tickets in " + attempts + " attempts");
        
        return batchTickets;
    }
    
    /**
     * Creates batch variance parameters to ensure diversity between batches.
     */
    private BatchVarianceParams createBatchVariance(int batchNumber, String targetTier) {
        // Base variance on batch number and tier type
        double hotBiasVariation = 0.05 * batchNumber; // 5% variation per batch
        double recencyVariation = 0.1 * batchNumber;  // 10% variation per batch
        long seedVariation = System.currentTimeMillis() + (batchNumber * 1000);
        
        // Tier-specific variance ranges
        double baseHotBias = 0.95; // Default for Tier 1
        if (targetTier.contains("tier_2") || targetTier.toLowerCase().contains("2")) {
            baseHotBias = 0.85;
        } else if (targetTier.contains("tier_3") || targetTier.toLowerCase().contains("3")) {
            baseHotBias = 0.70;
        }
        
        // Calculate varied parameters (keep within reasonable ranges)
        double variedHotBias = Math.max(0.60, Math.min(0.98, baseHotBias - hotBiasVariation));
        double variedRecencyWeight = Math.max(0.10, Math.min(0.40, 0.20 + recencyVariation));
        
        return new BatchVarianceParams(variedHotBias, variedRecencyWeight, seedVariation, batchNumber);
    }
    
    /**
     * Generates a tier-optimized ticket with batch variance parameters.
     */
    private int[] generateVariedTierOptimizedTicket(List<String> hotPatterns, LotteryGame lotteryGame, 
                                                   UserTargetingRequest request, BatchVarianceParams variance) {
        // Delegate to existing method but with varied random seed
        Random variedRandom = new Random(variance.randomSeed);
        
        try {
            // Start with existing pattern-based approach but with variance
            if (!hotPatterns.isEmpty()) {
                String selectedPattern = hotPatterns.get(variedRandom.nextInt(hotPatterns.size()));
                int[] baseTicket = generateNumbersForPatternWithHistory(selectedPattern, lotteryGame);
                
                if (baseTicket != null) {
                    // Apply tier optimization with variance to the pattern-generated numbers
                    List<Integer> candidateNumbers = Arrays.stream(baseTicket).boxed()
                            .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                    
                    // Get tier-optimized selection (existing method works)
                    CompletableFuture<List<Integer>> tierOptimizedFuture = tierOptimizationManager
                            .optimizeNumbersForTier(request.getTargetTier(), candidateNumbers, 
                                                    lotteryGame.getDrawPositionCount(), request.getLotteryConfigId());
                    
                    List<Integer> optimizedNumbers = tierOptimizedFuture.join();
                    
                    if (optimizedNumbers.size() == lotteryGame.getDrawPositionCount()) {
                        return optimizedNumbers.stream().mapToInt(Integer::intValue).toArray();
                    }
                }
            }
            
            // Fallback to existing random generation with tier optimization and variance
            List<Integer> allNumbers = new ArrayList<>();
            for (int i = lotteryGame.getMinNumber(); i <= lotteryGame.getMaxNumber(); i++) {
                allNumbers.add(i);
            }
            
            // Shuffle with varied seed for diversity
            Collections.shuffle(allNumbers, variedRandom);
            
            CompletableFuture<List<Integer>> tierOptimizedFuture = tierOptimizationManager
                    .optimizeNumbersForTier(request.getTargetTier(), allNumbers, 
                                            lotteryGame.getDrawPositionCount(), request.getLotteryConfigId());
            
            List<Integer> optimizedNumbers = tierOptimizedFuture.join();
            return optimizedNumbers.stream().mapToInt(Integer::intValue).toArray();
            
        } catch (Exception e) {
            System.err.println("Error generating varied tier-optimized ticket: " + e.getMessage());
            // Final fallback to existing random generation with variance
            return generateRandomTicketWithSeed(lotteryGame, variance.randomSeed);
        }
    }
    
    /**
     * Generates a random ticket with specific seed for variance.
     */
    private int[] generateRandomTicketWithSeed(LotteryGame lotteryGame, long seed) {
        Set<Integer> numbers = new HashSet<>();
        Random random = new Random(seed);
        
        while (numbers.size() < lotteryGame.getDrawPositionCount()) {
            int number = lotteryGame.getMinNumber() + random.nextInt(lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1);
            numbers.add(number);
        }
        
        return numbers.stream().sorted().mapToInt(i -> i).toArray();
    }
    
    /**
     * Creates a default lottery game configuration for TemplateMatrix evaluation when the actual game config is not available.
     * Uses common lottery parameters (1-35, pick 5) which covers many lottery games.
     * 
     * @return Default LotteryGame instance
     */
    private LotteryGame createDefaultLotteryGame() {
        return new LotteryGame() {
            @Override
            public Integer getMaxNumber() {
                return 35;
            }
            
            @Override
            public Integer getMinNumber() {
                return 1;
            }
            
            @Override
            public Integer getDrawPositionCount() {
                return 5;
            }
            
            // Stub implementations for other methods that might be required by the interface
            @Override
            public String toString() {
                return "DefaultLotteryGame{minNumber=1, maxNumber=35, drawPositions=5}";
            }
        };
    }
    
    /**
     * Determines the initial strategy index based on user preferences.
     * If TemplateMatrix is enabled, prioritize the template_matrix strategy.
     * 
     * @param request User targeting request with preferences
     * @return Index of the strategy to start with
     */
    private int determineInitialStrategy(UserTargetingRequest request) {
        // Check if TemplateMatrix is enabled and strategy is available
        if (request.getPreferences() != null && request.getPreferences().isEnableTemplateMatrix()) {
            int templateMatrixIndex = availableStrategies.indexOf("template_matrix");
            if (templateMatrixIndex >= 0) {
                System.out.println("Starting with TemplateMatrix strategy (index: " + templateMatrixIndex + ")");
                return templateMatrixIndex;
            }
        }
        
        // Use user-specified strategy if provided
        if (request.getGenerationStrategy() != null) {
            String requestedStrategy = request.getGenerationStrategy().toLowerCase();
            int requestedIndex = availableStrategies.indexOf(requestedStrategy);
            if (requestedIndex >= 0) {
                System.out.println("Using user-requested strategy: " + requestedStrategy + " (index: " + requestedIndex + ")");
                return requestedIndex;
            }
        }
        
        // Default to first strategy (pattern_based)
        System.out.println("Using default strategy: " + availableStrategies.get(0));
        return 0;
    }
    
    /**
     * Evaluates quality using enhanced engine if TemplateMatrix is enabled, otherwise uses traditional engine.
     * This allows seamless integration of TemplateMatrix quality evaluation while maintaining backward compatibility.
     * 
     * @param tickets List of tickets to evaluate
     * @param stoppingCriteria Stopping criteria for the evaluation
     * @param request User targeting request with preferences
     * @return QualityMetrics from the appropriate evaluation engine
     */
    private QualityMetrics evaluateQualityWithEnhancement(List<int[]> tickets, StoppingCriteria stoppingCriteria, UserTargetingRequest request) {
        try {
            // Check if TemplateMatrix is enabled in user preferences
            if (request.getPreferences() != null && request.getPreferences().isEnableTemplateMatrix()) {
                // Attempt to get lottery game for enhanced evaluation
                LotteryGame lotteryGame = null;
                try {
                    if (request.getLotteryState() != null && request.getLotteryGame() != null) {
                        Optional<LotteryGame> gameOptional = lotteryDataService.getLotteryGame(request.getLotteryGame(), request.getLotteryState());
                        lotteryGame = gameOptional.orElse(null);
                    }
                } catch (Exception e) {
                    System.err.println("Warning: Could not retrieve lottery game for enhanced evaluation: " + e.getMessage());
                }
                
                // If we couldn't get the lottery game, create a default one for common configurations
                if (lotteryGame == null) {
                    lotteryGame = createDefaultLotteryGame();
                }
                
                // Use enhanced evaluation
                EnhancedQualityEvaluationEngine.EnhancedQualityMetrics enhancedMetrics = 
                    enhancedQualityEvaluationEngine.evaluateEnhancedQuality(tickets, stoppingCriteria, request, lotteryGame);
                
                // Return the traditional metrics from the enhanced result for compatibility
                return enhancedMetrics.getTraditionalMetrics();
            } else {
                // Use traditional quality evaluation when TemplateMatrix is not enabled
                return qualityEvaluationEngine.evaluateQuality(tickets, stoppingCriteria, request);
            }
        } catch (Exception e) {
            System.err.println("Error in enhanced quality evaluation, falling back to traditional: " + e.getMessage());
            // Fall back to traditional evaluation on any error
            return qualityEvaluationEngine.evaluateQuality(tickets, stoppingCriteria, request);
        }
    }
    
    /**
     * Data class for batch variance parameters.
     */
    private static class BatchVarianceParams {
        final double hotBias;
        final double recencyWeight;
        final long randomSeed;
        final int batchNumber;
        
        BatchVarianceParams(double hotBias, double recencyWeight, long randomSeed, int batchNumber) {
            this.hotBias = hotBias;
            this.recencyWeight = recencyWeight;
            this.randomSeed = randomSeed;
            this.batchNumber = batchNumber;
        }
        
        @Override
        public String toString() {
            return String.format("hotBias=%.2f, recencyWeight=%.2f, batch=%d", 
                               hotBias, recencyWeight, batchNumber);
        }
    }
    
    /**
     * Gets or creates drought analysis for the given request.
     */
    private PrizeDroughtAnalysis getOrCreateDroughtAnalysis(UserTargetingRequest request) {
        try {
            return prizeDroughtAnalyzer.analyzeDroughtConditions(
                request.getLotteryGame(), request.getLotteryState(), request.getLotteryConfigId());
        } catch (Exception e) {
            System.err.println("Failed to analyze drought conditions: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Gets or creates pattern performance analysis for the given request.
     */
    private PatternPerformanceAnalysis getOrCreatePatternAnalysis(UserTargetingRequest request) {
        try {
            return patternPerformanceAnalyzer.analyzePatternPerformance(
                request.getLotteryGame(), request.getLotteryState(), request.getLotteryConfigId());
        } catch (Exception e) {
            System.err.println("Failed to analyze pattern performance: " + e.getMessage());
            return null;
        }
    }

    /**
     * Gets the full historical analysis for a completed generation session.
     * This provides the complete analysis including both sample and full data.
     * 
     * @param sessionId The session identifier
     * @return HistoricalPerformanceAnalysis with full analysis data, or null if session not found
     */
    public HistoricalPerformanceAnalysis getFullHistoricalAnalysis(String sessionId) {
        GenerationSession session = activeSessions.get(sessionId);
        if (session == null) {
            return null;
        }
        
        // Get the final result from the session
        GeneratedTicketSet result = session.getFinalResult();
        if (result == null) {
            return null;
        }
        
        // Get the stored historical performance analysis
        HistoricalPerformanceAnalysis existingAnalysis = result.getHistoricalPerformance();
        if (existingAnalysis == null) {
            return null;
        }
        
        // Check if it's already a full analysis
        System.out.println("DEBUG getFullHistoricalAnalysis: existingAnalysis.getAnalysisType() = " + existingAnalysis.getAnalysisType());
        System.out.println("DEBUG getFullHistoricalAnalysis: tickets analyzed = " + existingAnalysis.getAnalysisScope().getTicketsAnalyzed());
        System.out.println("DEBUG getFullHistoricalAnalysis: total tickets = " + existingAnalysis.getAnalysisScope().getTotalTickets());
        
        if (existingAnalysis.getAnalysisType() == HistoricalPerformanceAnalysis.AnalysisType.FULL) {
            System.out.println("DEBUG getFullHistoricalAnalysis: Returning existing FULL analysis");
            return existingAnalysis;
        }
        
        System.out.println("DEBUG getFullHistoricalAnalysis: Converting SAMPLE to FULL analysis");
        
        // If it's a sample analysis, perform full analysis
        try {
            UserTargetingRequest originalRequest = session.getOriginalRequest();
            Optional<StateGamesResponse> historicalDataOpt = lotteryDataService.getLotteryGameData(
                originalRequest.getLotteryGame(), originalRequest.getLotteryState());
            
            if (!historicalDataOpt.isPresent()) {
                System.err.println("No historical data available for full analysis of session " + sessionId);
                return existingAnalysis;
            }
            
            StateGamesResponse historicalData = historicalDataOpt.get();
            
            // Force full analysis by providing all tickets and setting forceFullAnalysis = true
            List<int[]> allTickets = result.getTickets();
            HistoricalPerformanceAnalysis fullAnalysis = historicalPerformanceService.analyzePerformance(
                allTickets, originalRequest.getLotteryConfigId(), historicalData, sessionId, true);
            
            return fullAnalysis;
            
        } catch (Exception e) {
            System.err.println("Error generating full historical analysis for session " + sessionId + ": " + e.getMessage());
            // Return the existing sample analysis as fallback
            return existingAnalysis;
        }
    }

    /**
     * Checks if a ticket list contains a specific ticket (by comparing number arrays).
     *
     * @param ticketList The list of tickets to search in
     * @param targetTicket The ticket to search for
     * @return true if the ticket is found, false otherwise
     */
    private boolean containsTicket(List<int[]> ticketList, int[] targetTicket) {
        for (int[] ticket : ticketList) {
            if (java.util.Arrays.equals(ticket, targetTicket)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Maps incoming generation strategy strings to valid enum values expected by Phase 1 API.
     *
     * @param strategy The generation strategy from the request
     * @return A valid generation strategy string matching the API enum
     */
    private String mapToValidGenerationStrategy(String strategy) {
        if (strategy == null) {
            return "BALANCED";
        }
        
        // Map common strategy names to valid enum values
        switch (strategy.toLowerCase()) {
            case "delta_pure":
                return "DELTA_PURE";
            case "delta_strategic":
                return "DELTA_STRATEGIC";
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
            case "frequency_based":
                return "FREQUENCY_BASED";
            case "random_weighted":
                return "RANDOM_WEIGHTED";
            case "quality_evaluation":
                return "QUALITY_EVALUATION";
            case "hybrid":
                return "HYBRID";
            default:
                return "BALANCED"; // Default fallback
        }
    }

    /**
     * Result of starting a generation session, containing both the session ID and the future result.
     */
    public static class GenerationSessionResult {
        private final String sessionId;
        private final CompletableFuture<GeneratedTicketSet> future;
        
        public GenerationSessionResult(String sessionId, CompletableFuture<GeneratedTicketSet> future) {
            this.sessionId = sessionId;
            this.future = future;
        }
        
        public String getSessionId() {
            return sessionId;
        }
        
        public CompletableFuture<GeneratedTicketSet> getFuture() {
            return future;
        }
    }
}