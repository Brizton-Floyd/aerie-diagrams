package com.floyd.lottoptions.legacy.desktop.controller;

import com.floyd.lottoptions.legacy.desktop.generation.engine.GeneratedTicketSet;
import com.floyd.lottoptions.legacy.desktop.generation.engine.HistoricalPerformanceAnalysis;
import com.floyd.lottoptions.legacy.desktop.generation.engine.MasterGenerationEngine;
import com.floyd.lottoptions.legacy.desktop.generation.engine.ProgressUpdate;
import com.floyd.lottoptions.legacy.desktop.quality.UserTargetingRequest;
import com.floyd.lottoptions.legacy.desktop.shared.service.LotteryStateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * REST controller for Phase 3 ticket generation endpoints.
 * Provides intelligent lottery ticket generation with real-time progress streaming.
 */
@RestController
@RequestMapping("/api/v2")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class TicketGenerationController {
    
    private static final Logger log = LoggerFactory.getLogger(TicketGenerationController.class);
    
    private final MasterGenerationEngine generationEngine;
    private final LotteryStateService lotteryStateService;
    private final Map<String, Flux<String>> activeStreams = new ConcurrentHashMap<>();

    /**
     * Constructor with dependency injection.
     *
     * @param generationEngine the ticket generation engine (configured in {@code ApplicationConfig})
     * @param lotteryStateService the server's lottery state service
     */
    public TicketGenerationController(MasterGenerationEngine generationEngine,
                                      LotteryStateService lotteryStateService) {
        this.generationEngine = generationEngine;
        this.lotteryStateService = lotteryStateService;
    }

    /**
     * POST /api/v2/generate-tickets
     * Main ticket generation endpoint that starts async generation and returns session info.
     * 
     * @param request UserTargetingRequest with generation parameters
     * @return Mono containing session information for progress tracking
     */
    @PostMapping("/generate-tickets")
    public Mono<ResponseEntity<GenerationStartResponse>> generateTickets(
            @RequestBody UserTargetingRequest request) {
        
        log.info("Received ticket generation request: {}", request);
        
        if (request == null) {
            return Mono.just(ResponseEntity.badRequest().build());
        }

        try {
            // Validate lottery game exists
            if (request.getLotteryState() != null && request.getLotteryGame() != null) {
                if (!isValidLotteryGame(request.getLotteryState(), request.getLotteryGame())) {
                    log.warn("Invalid lottery game: {} in state {}", request.getLotteryGame(), request.getLotteryState());
                    return Mono.just(ResponseEntity.badRequest().build());
                }
            }

            // Start async generation with progress tracking and get session ID immediately
            var sessionResult = generationEngine.startGeneration(request, this::handleProgressUpdate);
            String sessionId = sessionResult.getSessionId();
            CompletableFuture<GeneratedTicketSet> generationFuture = sessionResult.getFuture();
            
            // Create SSE stream for this session
            Flux<String> progressStream = createProgressStream(sessionId);
            activeStreams.put(sessionId, progressStream);

            // Return immediate response with actual session ID from engine
            GenerationStartResponse response = new GenerationStartResponse(
                sessionId, 
                "STARTED",
                "Generation process initiated successfully",
                request.getNumberOfTickets(),
                request.getLotteryConfigId()
            );

            // Handle completion asynchronously
            generationFuture.whenComplete((result, throwable) -> {
                if (throwable != null) {
                    log.error("Generation failed for session {}: {}", sessionId, throwable.getMessage());
                } else {
                    log.info("Generation completed for session {}: {} tickets generated", 
                           sessionId, result.getTicketCount());
                }
                // Stream will be cleaned up by timeout or client disconnect
            });

            return Mono.just(ResponseEntity.ok(response));

        } catch (Exception e) {
            log.error("Failed to start ticket generation", e);
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
        }
    }

    /**
     * GET /api/v2/generation-status/{sessionId}
     * Server-Sent Events endpoint for real-time progress streaming.
     * 
     * @param sessionId Session identifier for tracking
     * @return Flux of SSE events with progress updates
     */
    @GetMapping(value = "/generation-status/{sessionId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> getGenerationStatus(@PathVariable String sessionId) {
        
        log.info("SSE connection established for session: {}", sessionId);

        // Get or create progress stream for this session
        Flux<String> progressStream = activeStreams.get(sessionId);
        
        if (progressStream == null) {
            // Session not found or expired
            return Flux.just(formatSSEData("error", "Session not found or expired"));
        }

        return progressStream
            .doOnSubscribe(subscription -> log.info("Client subscribed to session {}", sessionId))
            .doOnCancel(() -> {
                log.info("Client cancelled subscription for session {}", sessionId);
                activeStreams.remove(sessionId);
            })
            .doOnComplete(() -> {
                log.info("Progress stream completed for session {}", sessionId);
                activeStreams.remove(sessionId);
            })
            .doOnError(error -> {
                log.error("Error in progress stream for session {}: {}", sessionId, error.getMessage());
                activeStreams.remove(sessionId);
            });
    }

    /**
     * GET /api/v2/generation-result/{sessionId}
     * Get final generation results for a completed session.
     * 
     * @param sessionId Session identifier
     * @return Mono containing the final GeneratedTicketSet
     */
    @GetMapping("/generation-result/{sessionId}")
    public Mono<ResponseEntity<GeneratedTicketSet>> getGenerationResult(@PathVariable String sessionId) {
        
        log.info("Fetching generation result for session: {}", sessionId);

        try {
            // First check if we have a completed result
            GeneratedTicketSet result = generationEngine.getGenerationResult(sessionId);
            
            if (result != null) {
                // Generation is complete, return the actual tickets
                log.info("Returning completed result for session {} with {} tickets", 
                        sessionId, result.getTickets().size());
                return Mono.just(ResponseEntity.ok(result));
            }
            
            // Check current progress to determine status
            ProgressUpdate progress = generationEngine.getSessionProgress(sessionId);
            
            if (progress == null) {
                // Session not found
                log.warn("Session {} not found", sessionId);
                return Mono.just(ResponseEntity.notFound().build());
            }
            
            if (!progress.isFinished()) {
                // Generation still in progress
                double progressPercentage = (progress.getSuccessfulBatches() + progress.getFailedBatches()) * 10.0; // rough estimate
                log.info("Session {} still in progress: attempt {}, batches: {}", sessionId, progress.getCurrentAttempt(), progress.getTotalBatches());
                return Mono.just(ResponseEntity.status(HttpStatus.ACCEPTED)
                               .header("X-Progress-Attempt", String.valueOf(progress.getCurrentAttempt()))
                               .header("X-Progress-Status", progress.getStatus().toString())
                               .header("X-Successful-Batches", String.valueOf(progress.getSuccessfulBatches()))
                               .body(null));
            }
            
            // Generation finished but no result available (likely failed)
            log.warn("Session {} finished but no result available - likely failed", sessionId);
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());

        } catch (Exception e) {
            log.error("Failed to fetch generation result for session {}", sessionId, e);
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
        }
    }

    /**
     * DELETE /api/v2/generation-session/{sessionId}
     * Cancel an active generation session.
     * 
     * @param sessionId Session to cancel
     * @return Mono containing cancellation result
     */
    @DeleteMapping("/generation-session/{sessionId}")
    public Mono<ResponseEntity<Map<String, String>>> cancelGeneration(@PathVariable String sessionId) {
        
        log.info("Cancellation requested for session: {}", sessionId);

        try {
            boolean cancelled = generationEngine.cancelSession(sessionId);
            
            if (cancelled) {
                // Clean up the stream
                activeStreams.remove(sessionId);
                
                Map<String, String> response = Map.of(
                    "sessionId", sessionId,
                    "status", "CANCELLED",
                    "message", "Generation cancelled successfully"
                );
                return Mono.just(ResponseEntity.ok(response));
            } else {
                Map<String, String> response = Map.of(
                    "sessionId", sessionId,
                    "status", "NOT_FOUND",
                    "message", "Session not found or already completed"
                );
                return Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).body(response));
            }

        } catch (Exception e) {
            log.error("Failed to cancel session {}", sessionId, e);
            Map<String, String> response = Map.of(
                "sessionId", sessionId,
                "status", "ERROR",
                "message", "Failed to cancel session: " + e.getMessage()
            );
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response));
        }
    }

    /**
     * GET /api/v2/generation-result/{sessionId}/full-historical-analysis
     * Get comprehensive historical analysis for a completed generation session.
     * This provides the complete analysis including detailed ticket-by-ticket performance.
     * 
     * @param sessionId Session identifier
     * @return Mono containing the full HistoricalPerformanceAnalysis
     */
    @GetMapping("/generation-result/{sessionId}/full-historical-analysis")
    public Mono<ResponseEntity<HistoricalPerformanceAnalysis>> getFullHistoricalAnalysis(@PathVariable String sessionId) {
        
        log.info("Fetching full historical analysis for session: {}", sessionId);

        try {
            HistoricalPerformanceAnalysis fullAnalysis = generationEngine.getFullHistoricalAnalysis(sessionId);
            
            if (fullAnalysis != null) {
                log.info("Returning full historical analysis for session {} with {} insights", 
                        sessionId, fullAnalysis.getInsights() != null ? fullAnalysis.getInsights().size() : 0);
                return Mono.just(ResponseEntity.ok(fullAnalysis));
            } else {
                log.warn("No historical analysis data available for session {}", sessionId);
                return Mono.just(ResponseEntity.notFound().build());
            }

        } catch (Exception e) {
            log.error("Failed to fetch full historical analysis for session {}", sessionId, e);
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
        }
    }

    /**
     * GET /api/v2/generation-statistics
     * Get engine statistics and health information.
     * 
     * @return Mono containing engine statistics
     */
    @GetMapping("/generation-statistics")
    public Mono<ResponseEntity<Map<String, Object>>> getGenerationStatistics() {
        
        try {
            Map<String, Object> stats = generationEngine.getEngineStatistics();
            stats.put("activeStreams", activeStreams.size());
            return Mono.just(ResponseEntity.ok(stats));

        } catch (Exception e) {
            log.error("Failed to fetch generation statistics", e);
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
        }
    }

    // Helper methods

    /**
     * Creates a reactive stream for progress updates.
     */
    private Flux<String> createProgressStream(String sessionId) {
        return Flux.interval(Duration.ofMillis(500)) // Update every 500ms
                .map(tick -> {
                    ProgressUpdate progress = generationEngine.getSessionProgress(sessionId);
                    if (progress != null) {
                        return formatSSEData("progress", progress.toJsonString());
                    } else {
                        // Session completed or not found
                        return formatSSEData("completed", "{\"status\":\"completed\",\"sessionId\":\"" + sessionId + "\"}");
                    }
                })
                .takeWhile(data -> !data.contains("\"status\":\"completed\""))
                .concatWith(Flux.just(formatSSEData("end", "{\"status\":\"stream_ended\"}")))
                .doOnNext(data -> log.debug("Sending SSE data for session {}: {}", sessionId, data));
    }

    /**
     * Handles progress updates from the generation engine.
     */
    private void handleProgressUpdate(ProgressUpdate update) {
        log.debug("Progress update for session {}: {}", update.getSessionId(), update);
        // Progress updates are handled by the reactive stream
    }

    /**
     * Formats data for Server-Sent Events.
     */
    private String formatSSEData(String event, String data) {
        return String.format("event: %s\ndata: %s\n\n", event, data);
    }

    /**
     * Validates if the lottery game exists for the given state.
     */
    private boolean isValidLotteryGame(String state, String game) {
        try {
            return lotteryStateService.getLottoGameDrawData(game, state).isPresent();
        } catch (Exception e) {
            log.error("Error validating lottery game {} for state {}: {}", game, state, e.getMessage());
            return false;
        }
    }

    /**
     * Generates a unique session ID.
     */

    /**
     * Response model for generation start endpoint.
     */
    public static class GenerationStartResponse {
        private final String sessionId;
        private final String status;
        private final String message;
        private final int requestedTickets;
        private final String lotteryConfigId;

        public GenerationStartResponse(String sessionId, String status, String message,
                                     int requestedTickets, String lotteryConfigId) {
            this.sessionId = sessionId;
            this.status = status;
            this.message = message;
            this.requestedTickets = requestedTickets;
            this.lotteryConfigId = lotteryConfigId;
        }

        // Getters
        public String getSessionId() { return sessionId; }
        public String getStatus() { return status; }
        public String getMessage() { return message; }
        public int getRequestedTickets() { return requestedTickets; }
        public String getLotteryConfigId() { return lotteryConfigId; }
    }
}