package com.floyd.lottoptions.bff.service;

import com.floyd.lottoptions.bff.assembler.GeneratedNumbersAssembler;
import com.floyd.lottoptions.bff.client.CoreApiClient;
import com.floyd.lottoptions.bff.controller.dto.GenerateNumbersRequest;
import com.floyd.lottoptions.bff.viewmodel.GeneratedNumbersViewModel;
import com.floyd.lottoptions.core.contract.generate.RandomNumberGeneratorRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Objects;

/**
 * Orchestration service for the Smart Generator number-generation endpoint
 * (FR-013-SERVICE, ADR-0003).
 *
 * <p>Issues exactly one Core API call per invocation via
 * {@link CoreApiClient#generateNumbers(RandomNumberGeneratorRequest)} and delegates
 * projection to {@link GeneratedNumbersAssembler}. No domain logic lives here;
 * this service is a thin relay that maps inputs and forwards the Core response.</p>
 *
 * <p>Serves as a peer to {@link CatalogService} (FR-008-E) - a separate service class
 * for a separate endpoint concern rather than burdening {@link DashboardService} with
 * a fourth responsibility (FR-013 Section 1.2 constraint 3).</p>
 *
 * <p>All public-API arguments are validated with {@link Objects#requireNonNull} (Effective
 * Java Item 49). The {@code numberGenerator} field of the request is validated separately
 * with an {@link IllegalArgumentException} guard, as a {@code null} strategy value
 * would produce a semantically invalid Core request.</p>
 *
 * <p>The class is {@code final} because it is not designed for extension
 * (Effective Java Items 17 and 19). Constructor injection is used throughout;
 * no field {@code @Autowired} (Effective Java Item 5).</p>
 *
 * <p>No {@code block()} calls are made anywhere in the reactive chain - all operations
 * remain non-blocking (FR-013 Section 1.2 constraint 2).</p>
 */
@Service
public final class SmartGeneratorService {

    private static final Logger log = LoggerFactory.getLogger(SmartGeneratorService.class);

    private final CoreApiClient coreApiClient;
    private final GeneratedNumbersAssembler generatedNumbersAssembler;

    /**
     * Constructs a {@code SmartGeneratorService} with its required collaborators.
     *
     * @param coreApiClient             reactive HTTP client for the Core API
     * @param generatedNumbersAssembler assembles the Core API response into a view model
     */
    public SmartGeneratorService(CoreApiClient coreApiClient,
                                 GeneratedNumbersAssembler generatedNumbersAssembler) {
        this.coreApiClient = coreApiClient;
        this.generatedNumbersAssembler = generatedNumbersAssembler;
    }

    /**
     * Generates lottery number sets for the given state and game by relaying to the Core API.
     *
     * <p>Builds a {@link RandomNumberGeneratorRequest} from the path variables and the
     * request body, calls {@link CoreApiClient#generateNumbers(RandomNumberGeneratorRequest)},
     * and maps the result via {@link GeneratedNumbersAssembler#assemble}. Issues exactly one
     * Core API call per invocation (FR-013-SERVICE). Errors from the Core API propagate as
     * {@link CoreApiClient} raises them.</p>
     *
     * <p>Field mapping from BFF DTO to Core request:</p>
     * <ul>
     *   <li>{@code state} → {@code lotteryState}</li>
     *   <li>{@code game} → {@code lotteryGame}</li>
     *   <li>{@code request.numberGenerator()} → {@code numberGenerator}</li>
     *   <li>{@code request.numberSetsPerPattern()} → {@code numberSetsPerPattern}</li>
     *   <li>{@code request.targetedPrizeLevel()} → {@code targetedPrizeLevel}</li>
     *   <li>{@code request.drawDaysPerWeek()} → {@code drawDaysPerWeek}</li>
     *   <li>{@code null} → {@code templateSelectionStrategy} (not used by Smart Generator)</li>
     *   <li>{@code null} → {@code allowedGroups} (not used by Smart Generator)</li>
     * </ul>
     *
     * @param state   the lottery state code (e.g. {@code "TX"}); must not be {@code null}
     * @param game    the lottery game name (e.g. {@code "Cash Five"}); must not be {@code null}
     * @param request the generation parameters from the Angular UI; must not be {@code null}
     * @return a {@link Mono} emitting the {@link GeneratedNumbersViewModel}, or propagating
     *         any upstream error
     * @throws NullPointerException     if {@code state}, {@code game}, or {@code request}
     *                                  is {@code null}
     * @throws IllegalArgumentException if {@code request.numberGenerator()} is {@code null}
     */
    public Mono<GeneratedNumbersViewModel> generateNumbers(String state,
                                                           String game,
                                                           GenerateNumbersRequest request) {
        Objects.requireNonNull(state, "state must not be null");
        Objects.requireNonNull(game, "game must not be null");
        Objects.requireNonNull(request, "request must not be null");

        if (request.numberGenerator() == null) {
            throw new IllegalArgumentException("request.numberGenerator must not be null");
        }

        log.debug("Generating numbers for state={}, game={}, generator={}",
                state, game, request.numberGenerator());

        RandomNumberGeneratorRequest coreRequest = buildCoreRequest(state, game, request);

        return coreApiClient.generateNumbers(coreRequest)
                .map(generatedNumbersAssembler::assemble);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private RandomNumberGeneratorRequest buildCoreRequest(String state,
                                                          String game,
                                                          GenerateNumbersRequest request) {
        return new RandomNumberGeneratorRequest(state, game, request.numberGenerator(),
                request.numberSetsPerPattern(), request.targetedPrizeLevel(), request.drawDaysPerWeek(),
                null, null);
    }
}
