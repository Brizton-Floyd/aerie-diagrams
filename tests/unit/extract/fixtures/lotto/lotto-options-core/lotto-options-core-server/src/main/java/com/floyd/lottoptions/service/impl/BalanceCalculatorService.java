package com.floyd.lottoptions.service.impl;

import com.floyd.model.request.BalanceRecommendationRequest;
import com.floyd.model.request.MonthlyBacktestRequest;
import com.floyd.model.response.BalanceRecommendationResponse;
import com.floyd.model.response.MonthlyBacktestResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;

@Slf4j
@Service
public class BalanceCalculatorService {

    private final GameOutBacktestService backtestService;
    private final Clock clock;

    public BalanceCalculatorService(GameOutBacktestService backtestService, Clock clock) {
        this.backtestService = backtestService;
        this.clock = clock;
    }
    
    public Mono<BalanceRecommendationResponse> calculateRecommendedBalance(BalanceRecommendationRequest request) {
        return Mono.fromCallable(() -> {
            log.info("Calculating recommended balance: game={}, betLevel={}, risk={}", 
                request.getGameId(), request.getBetLevel(), request.getRiskTolerance());
            
            request.validate();
            
            int currentYear = LocalDate.now(clock).getYear();
            int backtestYear = currentYear - 1;
            
            MonthlyBacktestRequest backtestRequest = MonthlyBacktestRequest.builder()
                .gameId(request.getGameId())
                .state(request.getState())
                .betLevel(request.getBetLevel())
                .year(backtestYear)
                .maxGameOut(9)
                .hPoolSize(6)
                .mPoolSize(8)
                .build();
            
            MonthlyBacktestResponse backtest = backtestService.generateMonthlyBacktest(backtestRequest).block();
            
            if (backtest == null || backtest.getMonthlyStats() == null) {
                throw new IllegalArgumentException("Unable to calculate balance - no backtest data available");
            }
            
            BigDecimal worstMonthLoss = backtest.getMonthlyStats().stream()
                .map(MonthlyBacktestResponse.MonthlyStats::getNetProfit)
                .filter(profit -> profit.compareTo(BigDecimal.ZERO) < 0)
                .min(BigDecimal::compareTo)
                .map(BigDecimal::abs)
                .orElse(BigDecimal.ZERO);
            
            BigDecimal multiplier;
            BigDecimal recommendedBalance;
            BigDecimal conservativeBalance;
            BigDecimal aggressiveBalance;
            
            switch (request.getRiskTolerance()) {
                case CONSERVATIVE:
                    multiplier = new BigDecimal("3.0");
                    recommendedBalance = worstMonthLoss.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
                    conservativeBalance = worstMonthLoss.multiply(new BigDecimal("3.5")).setScale(2, RoundingMode.HALF_UP);
                    aggressiveBalance = worstMonthLoss.multiply(new BigDecimal("2.5")).setScale(2, RoundingMode.HALF_UP);
                    break;
                case MODERATE:
                    multiplier = new BigDecimal("2.5");
                    recommendedBalance = worstMonthLoss.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
                    conservativeBalance = worstMonthLoss.multiply(new BigDecimal("3.0")).setScale(2, RoundingMode.HALF_UP);
                    aggressiveBalance = worstMonthLoss.multiply(new BigDecimal("2.0")).setScale(2, RoundingMode.HALF_UP);
                    break;
                case AGGRESSIVE:
                    multiplier = new BigDecimal("2.0");
                    recommendedBalance = worstMonthLoss.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
                    conservativeBalance = worstMonthLoss.multiply(new BigDecimal("2.5")).setScale(2, RoundingMode.HALF_UP);
                    aggressiveBalance = worstMonthLoss.multiply(new BigDecimal("1.5")).setScale(2, RoundingMode.HALF_UP);
                    break;
                default:
                    throw new IllegalArgumentException("Invalid risk tolerance: " + request.getRiskTolerance());
            }
            
            if (recommendedBalance.compareTo(new BigDecimal("5000")) < 0) {
                recommendedBalance = new BigDecimal("5000");
            }
            if (conservativeBalance.compareTo(new BigDecimal("5000")) < 0) {
                conservativeBalance = new BigDecimal("5000");
            }
            if (aggressiveBalance.compareTo(new BigDecimal("5000")) < 0) {
                aggressiveBalance = new BigDecimal("5000");
            }
            
            String reasoning = String.format(
                "Based on worst month loss of $%s (%d backtest), recommended balance provides %.1fx buffer for %s risk tolerance",
                worstMonthLoss.setScale(2, RoundingMode.HALF_UP),
                backtestYear,
                multiplier,
                request.getRiskTolerance().toString().toLowerCase()
            );
            
            return BalanceRecommendationResponse.builder()
                .gameId(request.getGameId())
                .betLevel(request.getBetLevel())
                .worstMonthLoss(worstMonthLoss)
                .recommendedBalance(recommendedBalance)
                .conservativeBalance(conservativeBalance)
                .aggressiveBalance(aggressiveBalance)
                .riskTolerance(request.getRiskTolerance())
                .reasoning(reasoning)
                .build();
                
        }).subscribeOn(Schedulers.boundedElastic());
    }
}
