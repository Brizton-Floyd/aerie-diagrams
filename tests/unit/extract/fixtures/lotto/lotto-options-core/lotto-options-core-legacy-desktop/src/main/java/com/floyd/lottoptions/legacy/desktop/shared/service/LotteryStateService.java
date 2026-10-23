package com.floyd.lottoptions.legacy.desktop.shared.service;

import com.floyd.persistence.model.request.StateGameAnalysisRequest;
import com.floyd.persistence.model.response.StateGamesResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Optional;

/**
 * The results-service reads the v2 generator and the games endpoints use: legacy's fork of
 * the two draw-history and games-for-state methods of Core's {@code LotteryStateService} and
 * {@code WebClientLotteryStateService}, typed with the results service's models.
 *
 * <p>Failed calls are translated: a draw-history 404 becomes {@link GameNotFoundException},
 * and a failed or timed-out connection or a 5xx becomes {@link ResultsServiceUnavailableException}.
 * Other failures propagate unchanged.</p>
 */
@Slf4j
public final class LotteryStateService {

    private static final String STATE_GAMES_PATH = "api/v1/state-games/{state}";

    private final WebClient webClient;
    private final JsonMapper jsonMapper;
    private final ResultsServiceLocation resultsService;

    /**
     * @param webClient      the reactive web client
     * @param jsonMapper     the mapper used to log request payloads
     * @param resultsService where the results service is; every request URL is built from it
     */
    public LotteryStateService(WebClient webClient, JsonMapper jsonMapper, ResultsServiceLocation resultsService) {
        this.webClient = webClient;
        this.jsonMapper = jsonMapper;
        this.resultsService = resultsService;
    }

    /**
     * Retrieves historical draw data for a specific lottery game by making a blocking
     * POST request to the results service.
     *
     * @param game  The name of the lottery game.
     * @param state The abbreviation of the state.
     * @return An {@link Optional} containing the {@link StateGamesResponse} with game and draw data,
     *         or an empty Optional if the response is null.
     * @throws GameNotFoundException if the results service has no such game in the state
     * @throws ResultsServiceUnavailableException if the results service is down or failing
     */
    public Optional<StateGamesResponse> getLottoGameDrawData(String game, String state) {
        String fullUri = resultsService.drawHistoryUrl();

        StateGameAnalysisRequest request = new StateGameAnalysisRequest();
        request.setStateName(state);
        request.setGameName(game);

        try {
            String requestJson = jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsString(request);
            // Only log at INFO level for non-Texas states (test requests)
            // Texas requests are typically background database updates
            if (!"Texas".equalsIgnoreCase(state) && !"texas".equalsIgnoreCase(state)) {
                log.info("\n=== PERSISTENCE API REQUEST ===\nPOST {}\nPayload:\n{}", fullUri, requestJson);
            } else {
                log.debug("\n=== PERSISTENCE API REQUEST (Background) ===\nPOST {}\nPayload:\n{}", fullUri, requestJson);
            }
        } catch (Exception e) {
            log.error("Failed to serialize request to JSON", e);
        }

        StateGamesResponse response = webClient.post()
                .uri(fullUri)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .body(Mono.just(request), StateGameAnalysisRequest.class)
                .retrieve()
                .bodyToMono(StateGamesResponse.class)
                .onErrorMap(WebClientResponseException.NotFound.class, e -> new GameNotFoundException(game, state, e))
                .onErrorMap(LotteryStateService::isUnavailable, ResultsServiceUnavailableException::new)
                .block();

        return Optional.ofNullable(response);
    }

    /**
     * Retrieves a list of all available lottery games for a given state by making a
     * blocking GET request to the results service ({@code GET /api/v1/state-games/{state}}).
     *
     * @param state The abbreviation of the state.
     * @return An {@link Optional} containing a list of games, or an empty Optional if the response is null.
     * @throws ResultsServiceUnavailableException if the results service is down or failing
     */
    public Optional<List<?>> getAllLottoGamesForState(String state) {
        List<?> data = webClient.get()
                .uri(resultsService.url(STATE_GAMES_PATH), state)
                .retrieve()
                .bodyToMono(List.class)
                .onErrorMap(LotteryStateService::isUnavailable, ResultsServiceUnavailableException::new)
                .block();

        return Optional.ofNullable(data);
    }

    /**
     * Whether a failed call means the results service is down or failing: the connection
     * failed or timed out ({@link WebClientRequestException}), or it answered with a 5xx.
     */
    private static boolean isUnavailable(Throwable error) {
        return error instanceof WebClientRequestException
                || error instanceof WebClientResponseException response
                        && response.getStatusCode().is5xxServerError();
    }
}
