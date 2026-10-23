package com.floyd.lottoptions.core.server.adapter.web;

import com.floyd.lottoptions.core.application.gameout.RecommendGameOut;
import com.floyd.lottoptions.core.application.gameout.RecommendMultiState;
import com.floyd.lottoptions.core.contract.gameout.GameOutRecommendationRequest;
import com.floyd.lottoptions.core.contract.gameout.GameOutRecommendationResponse;
import com.floyd.lottoptions.core.contract.gameout.MultiStateRecommendationRequest;
import com.floyd.lottoptions.core.contract.gameout.MultiStateRecommendationResponse;
import com.floyd.lottoptions.core.domain.draw.DrawHistoryUnavailableException;
import com.floyd.lottoptions.core.domain.draw.UnknownGameException;
import com.floyd.lottoptions.service.ResultsServiceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.concurrent.Callable;

/**
 * Core API endpoints for the game-out recommendation: one game's next draw, or every game of a
 * state within a budget. The recommendation runs on the bounded-elastic scheduler.
 *
 * <p>A request that breaks a rule, or names a game without draws, answers 400 without a body. A
 * missing game answers 404 and a down or failing results service 503, through
 * {@code com.floyd.lottoptions.controller.LiveApiExceptionHandler}; any other failure answers
 * 500 without a body.</p>
 */
@RestController
@RequestMapping("/api/v1/gameout")
public class GameOutRecommendationController {

    private static final Logger log = LoggerFactory.getLogger(GameOutRecommendationController.class);

    private final RecommendGameOut recommendGameOut;
    private final RecommendMultiState recommendMultiState;

    /**
     * @param recommendGameOut    the use case that recommends one game
     * @param recommendMultiState the use case that recommends a state's games
     */
    public GameOutRecommendationController(RecommendGameOut recommendGameOut,
                                           RecommendMultiState recommendMultiState) {
        this.recommendGameOut = recommendGameOut;
        this.recommendMultiState = recommendMultiState;
    }

    /**
     * Recommends a game's next draw: PLAY with what to play, or SKIP.
     *
     * <p>Example body: {@code {"gameId": "Daily 4 Morning", "state": "Texas", "betLevel": 1.00,
     * "maxGameOut": 9, "hPoolSize": 6, "mPoolSize": 8}}.</p>
     */
    @PostMapping("/recommendation")
    public Mono<ResponseEntity<GameOutRecommendationResponse>> getRecommendation(
            @RequestBody GameOutRecommendationRequest request) {

        log.info("Received recommendation request: game={}, betLevel={}",
            request.getGameId(), request.getBetLevel());

        return answer("Error generating recommendation", () -> GameOutRecommendationMapper.toResponse(
            recommendGameOut.recommend(GameOutRecommendationMapper.toDomain(request)), true));
    }

    /**
     * Recommends a state's games, with capital management.
     *
     * <p>Example body: {@code {"state": "Texas", "betLevel": 1.00, "maxGameOut": 9,
     * "accountBalance": 10000.00, "riskLevel": "LOW", "includeHistoricalPerformance": true,
     * "performanceYears": [2024, 2025]}}.</p>
     */
    @PostMapping("/recommendation/multi-state")
    public Mono<ResponseEntity<MultiStateRecommendationResponse>> getMultiStateRecommendation(
            @RequestBody MultiStateRecommendationRequest request) {

        log.info("Received multi-state recommendation request: state={}, betLevel={}, accountBalance={}, riskLevel={}",
            request.getState(), request.getBetLevel(), request.getAccountBalance(), request.getRiskLevel());

        return answer("Error generating multi-state recommendation", () -> GameOutRecommendationMapper.toResponse(
            recommendMultiState.recommend(GameOutRecommendationMapper.toDomain(request))));
    }

    private static <T> Mono<ResponseEntity<T>> answer(String failure, Callable<T> recommendation) {
        return Mono.fromCallable(recommendation)
            .subscribeOn(Schedulers.boundedElastic())
            .map(ResponseEntity::ok)
            .onErrorResume(IllegalArgumentException.class, e -> {
                log.error("Validation error: {}", e.getMessage());
                return Mono.just(ResponseEntity.badRequest().build());
            })
            .onErrorResume(GameOutRecommendationController::isUnexpected, e -> {
                log.error(failure, e);
                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
            });
    }

    /**
     * Whether an error falls to the catch-all 500. A missing game and a down results service go
     * to the live API's exception handler instead, for a 404 or 503.
     */
    private static boolean isUnexpected(Throwable error) {
        return !(error instanceof UnknownGameException || error instanceof DrawHistoryUnavailableException
            || error instanceof ResultsServiceUnavailableException);
    }
}
