package com.floyd.lottoptions.service.impl;

import com.floyd.lottoptions.config.PersistenceServiceProperties;
import com.floyd.lottoptions.core.server.adapter.resultsservice.ResultsServiceFailures;
import com.floyd.lottoptions.service.GameNotFoundException;
import com.floyd.lottoptions.service.LotteryStateService;
import com.floyd.lottoptions.service.ResultsServiceUnavailableException;
import com.floyd.persistence.model.request.StateGameAnalysisRequest;
import com.floyd.persistence.model.response.StateGamesResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

import java.util.Optional;

/**
 * Implementation of {@link LotteryStateService} that communicates with a remote
 * persistence service to fetch lottery data via WebClient.
 *
 * <p>Failed calls are translated: a draw-history 404 becomes {@link GameNotFoundException},
 * and a failed or timed-out connection or a 5xx becomes {@link ResultsServiceUnavailableException}.
 * Other failures propagate unchanged.</p>
 */
@Slf4j
@Service
public class WebClientLotteryStateService implements LotteryStateService {

    private final WebClient webClient;
    private final JsonMapper jsonMapper;
    private final PersistenceServiceProperties persistenceService;

    /**
     * Constructs the service with a {@link WebClient} for making HTTP requests.
     *
     * @param webClient The reactive web client.
     * @param jsonMapper The mapper used to log request payloads.
     * @param persistenceService The results-service settings every request URL is built from.
     */
    public WebClientLotteryStateService(WebClient webClient, JsonMapper jsonMapper,
                                        PersistenceServiceProperties persistenceService) {
        this.webClient = webClient;
        this.jsonMapper = jsonMapper;
        this.persistenceService = persistenceService;
    }

    /**
     * Retrieves historical draw data for a specific lottery game by making a blocking
     * POST request to the persistence service.
     *
     * @param game  The name of the lottery game.
     * @param state The abbreviation of the state.
     * @return An {@link Optional} containing the {@link StateGamesResponse} with game and draw data,
     *         or an empty Optional if the response is null.
     * @throws GameNotFoundException if the persistence service has no such game in the state
     * @throws ResultsServiceUnavailableException if the persistence service is down or failing
     */
    @Override
    public Optional<StateGamesResponse> getLottoGameDrawData(String game, String state) {
        String fullUri = persistenceService.drawHistoryUrl();

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
                .onErrorMap(ResultsServiceFailures::isUnavailable, ResultsServiceUnavailableException::new)
                .block();

        return Optional.ofNullable(response);
    }
}
