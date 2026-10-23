package com.floyd.lottoptions.core.server.adapter.web;

import com.floyd.lottoptions.core.application.generate.GenerateNumbers;
import com.floyd.lottoptions.core.application.generate.GeneratedTickets;
import com.floyd.lottoptions.core.application.generate.GenerationRequest;
import com.floyd.lottoptions.core.application.generate.GenerationStrategy;
import com.floyd.lottoptions.core.application.generate.UnknownGenerationStrategyException;
import com.floyd.lottoptions.core.contract.generate.GeneratedNumberData;
import com.floyd.lottoptions.core.contract.generate.PrizeLevelResult;
import com.floyd.lottoptions.core.contract.generate.RandomNumberGeneratorRequest;
import com.floyd.lottoptions.core.domain.game.GameId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.concurrent.CancellationException;

/**
 * Core API endpoint that generates tickets by a generation strategy and back-tests them over the
 * game's draw history.
 *
 * <p>The generation runs on {@link Schedulers#boundedElastic()}. Cancelling the returned
 * {@link Mono} (Core's async request timeout does) interrupts the generation thread, which stops
 * the search.</p>
 *
 * <p>An unknown {@code numberGenerator} answers 400 with the accepted values, a missing game 404
 * and a down or failing results service 503, through
 * {@code com.floyd.lottoptions.controller.LiveApiExceptionHandler}.</p>
 */
@RestController
@RequestMapping("/api/v1/analysis")
public class GenerateNumbersController {

    private static final Logger log = LoggerFactory.getLogger(GenerateNumbersController.class);

    private final GenerateNumbers generateNumbers;

    /**
     * @param generateNumbers the use case that generates the tickets
     */
    public GenerateNumbersController(GenerateNumbers generateNumbers) {
        this.generateNumbers = generateNumbers;
    }

    /**
     * Generates the request's tickets.
     *
     * @param request the game, the strategy and the search settings
     * @return the tickets and their prize levels; empty when the results service answered without
     *         the game
     */
    @PostMapping("/generate/numbers")
    public Mono<GeneratedNumberData> getRandomNumberGeneratedData(@RequestBody RandomNumberGeneratorRequest request) {
        return Mono.fromCallable(() -> generateNumbers.generate(toGenerationRequest(request))
                        .map(GenerateNumbersController::toResponse)
                        .orElse(null))
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(CancellationException.class, cancelled -> {
                    // The subscriber cancelled, so nobody is waiting for this outcome.
                    log.info("Number generation stopped: the request was cancelled");
                    return Mono.empty();
                });
    }

    private static GenerationRequest toGenerationRequest(RandomNumberGeneratorRequest request) {
        GenerationStrategy strategy = GenerationStrategy.fromWireName(request.numberGenerator())
                .orElseThrow(() -> new UnknownGenerationStrategyException(request.numberGenerator()));
        return new GenerationRequest(new GameId(request.lotteryState(), request.lotteryGame()), strategy,
                request.numberSetsPerPattern(), request.targetedPrizeLevel(), request.drawDaysPerWeek(),
                request.templateSelectionStrategy());
    }

    private static GeneratedNumberData toResponse(GeneratedTickets tickets) {
        return new GeneratedNumberData(
                tickets.tickets(),
                tickets.prizeLevels().stream()
                        .map(level -> new PrizeLevelResult(level.correctNumbers(), level.hits(), level.gamesOut(),
                                level.expectedDaysBeforeWin()))
                        .toList(),
                tickets.tickets().size(),
                tickets.expectedDaysForTargetedPrizeLevelWin());
    }
}
