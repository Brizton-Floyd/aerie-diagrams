package com.floyd.lottoptions.controller;

import com.floyd.lottoptions.service.GameNotFoundException;
import com.floyd.lottoptions.service.ResultsServiceUnavailableException;
import com.floyd.lottoptions.service.impl.BalanceCalculatorService;
import com.floyd.lottoptions.service.impl.GameOutBacktestService;
import com.floyd.model.request.BalanceRecommendationRequest;
import com.floyd.model.request.MonthlyBacktestRequest;
import com.floyd.model.request.MultiGameBacktestRequest;
import com.floyd.model.response.BalanceRecommendationResponse;
import com.floyd.model.response.MonthlyBacktestResponse;
import com.floyd.model.response.MultiGameBacktestResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

/**
 * The game-out backtest, balance and health endpoints. The recommendation endpoints under the
 * same path are {@code core.server.adapter.web.GameOutRecommendationController}.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/gameout")
public class GameOutController {
    
    private final GameOutBacktestService backtestService;
    private final BalanceCalculatorService balanceCalculatorService;
    
    public GameOutController(GameOutBacktestService backtestService,
                            BalanceCalculatorService balanceCalculatorService) {
        this.backtestService = backtestService;
        this.balanceCalculatorService = balanceCalculatorService;
    }
    
    /**
     * Get monthly backtest analysis for a specific year
     * 
     * POST /api/v1/gameout/backtest/monthly
     * 
     * Request body:
     * {
     *   "gameId": "Daily 4 Morning",
     *   "state": "Texas",
     *   "betLevel": 1.00,
     *   "year": 2025,
     *   "maxGameOut": 9,
     *   "hPoolSize": 6,
     *   "mPoolSize": 8
     * }
     */
    @PostMapping("/backtest/monthly")
    public Mono<ResponseEntity<MonthlyBacktestResponse>> getMonthlyBacktest(
            @RequestBody MonthlyBacktestRequest request) {
        
        log.info("Received monthly backtest request: game={}, year={}, betLevel={}", 
            request.getGameId(), request.getYear(), request.getBetLevel());
        
        return backtestService.generateMonthlyBacktest(request)
            .map(ResponseEntity::ok)
            .onErrorResume(IllegalArgumentException.class, e -> {
                log.error("Validation error: {}", e.getMessage());
                return Mono.just(ResponseEntity.badRequest().build());
            })
            .onErrorResume(GameOutController::isUnexpected, e -> {
                log.error("Error generating monthly backtest", e);
                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
            });
    }
    
    /**
     * Get multi-game backtest analysis for multiple games simultaneously
     * 
     * POST /api/v1/gameout/backtest/multi-game
     * 
     * Request body:
     * {
     *   "gameIds": ["Daily 4 Morning", "Daily 4 Day", "Daily 4 Evening", "Daily 4 Night"],
     *   "stateName": "Texas",
     *   "betLevel": 0.25,
     *   "years": [2024, 2025],
     *   "maxGameOut": 9,
     *   "hPoolSize": 6,
     *   "mPoolSize": 8
     * }
     */
    @PostMapping("/backtest/multi-game")
    public Mono<ResponseEntity<MultiGameBacktestResponse>> getMultiGameBacktest(
            @RequestBody MultiGameBacktestRequest request) {
        
        log.info("Received multi-game backtest request: games={}, years={}, betLevel={}", 
            request.getGameIds(), request.getYears(), request.getBetLevel());
        
        return backtestService.generateMultiGameBacktest(request)
            .map(ResponseEntity::ok)
            .onErrorResume(IllegalArgumentException.class, e -> {
                log.error("Validation error: {}", e.getMessage());
                return Mono.just(ResponseEntity.badRequest().build());
            })
            .onErrorResume(GameOutController::isUnexpected, e -> {
                log.error("Error generating multi-game backtest", e);
                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
            });
    }
    
    /**
     * Calculate recommended starting balance
     * 
     * POST /api/v1/gameout/balance/recommended
     * 
     * Request body:
     * {
     *   "gameId": "Daily 4 Morning",
     *   "state": "Texas",
     *   "betLevel": 1.00,
     *   "riskTolerance": "CONSERVATIVE"
     * }
     */
    @PostMapping("/balance/recommended")
    public Mono<ResponseEntity<BalanceRecommendationResponse>> getRecommendedBalance(
            @RequestBody BalanceRecommendationRequest request) {
        
        log.info("Received balance recommendation request: game={}, betLevel={}, risk={}", 
            request.getGameId(), request.getBetLevel(), request.getRiskTolerance());
        
        return balanceCalculatorService.calculateRecommendedBalance(request)
            .map(ResponseEntity::ok)
            .onErrorResume(IllegalArgumentException.class, e -> {
                log.error("Validation error: {}", e.getMessage());
                return Mono.just(ResponseEntity.badRequest().build());
            })
            .onErrorResume(GameOutController::isUnexpected, e -> {
                log.error("Error calculating recommended balance", e);
                return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
            });
    }
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public Mono<ResponseEntity<String>> health() {
        return Mono.just(ResponseEntity.ok("GameOut API is running"));
    }

    /**
     * Whether an error falls to the endpoints' catch-all 500. A missing game and a down
     * results service go to {@link LiveApiExceptionHandler} instead, for a 404 or 503.
     */
    private static boolean isUnexpected(Throwable error) {
        return !(error instanceof GameNotFoundException || error instanceof ResultsServiceUnavailableException);
    }
}
