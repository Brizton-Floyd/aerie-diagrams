package com.floyd.lottoptions.core.server.adapter.resultsservice;

import com.floyd.lottoptions.config.PersistenceServiceProperties;
import com.floyd.lottoptions.core.domain.catalog.Catalog;
import com.floyd.lottoptions.core.domain.catalog.GameCatalogSource;
import com.floyd.lottoptions.core.domain.catalog.StateCatalog;
import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.service.ResultsServiceUnavailableException;
import com.floyd.persistence.model.LotteryState;
import com.floyd.persistence.model.response.AllStateLottoGameResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Optional;

/**
 * Reads the catalog from the results service ({@code GET /api/v1/all/v2/state-games}) and one
 * state's game names ({@code GET /api/v1/state-games/{state}}). The one place that maps the
 * results service's {@link AllStateLottoGameResponse}; each game is mapped by
 * {@link ResultsServiceGames}.
 *
 * <p>States without a name and games without a full name are skipped. A failed or timed-out
 * connection or a 5xx throws {@link ResultsServiceUnavailableException}; other failures
 * propagate unchanged.</p>
 */
@Component
public class ResultsServiceCatalogAdapter implements GameCatalogSource {

    private static final Logger log = LoggerFactory.getLogger(ResultsServiceCatalogAdapter.class);

    private static final String ALL_STATE_GAMES_PATH = "api/v1/all/v2/state-games";
    private static final String STATE_GAMES_PATH = "api/v1/state-games/{state}";

    private final WebClient webClient;
    private final PersistenceServiceProperties resultsService;

    /**
     * @param webClient      the client every results-service call goes through
     * @param resultsService the results-service settings the request URL is built from
     */
    public ResultsServiceCatalogAdapter(WebClient webClient, PersistenceServiceProperties resultsService) {
        this.webClient = webClient;
        this.resultsService = resultsService;
    }

    /**
     * {@inheritDoc}
     *
     * @return the catalog, or empty when the results service answers with no body or no state list
     * @throws ResultsServiceUnavailableException if the results service is down or failing
     */
    @Override
    public Optional<Catalog> load() {
        String uri = resultsService.url(ALL_STATE_GAMES_PATH);
        log.debug("Fetching catalog from persistence service: GET {}", uri);

        AllStateLottoGameResponse response = webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(AllStateLottoGameResponse.class)
                .onErrorMap(ResultsServiceFailures::isUnavailable, ResultsServiceUnavailableException::new)
                .block();

        if (response == null || response.getLotteryStateGames() == null) {
            log.warn("Persistence service returned null catalog response from {}", uri);
            return Optional.empty();
        }

        List<StateCatalog> states = response.getLotteryStateGames().stream()
                .filter(state -> state != null && state.getStateRegion() != null)
                .map(ResultsServiceCatalogAdapter::toStateCatalog)
                .toList();
        return Optional.of(new Catalog(states));
    }

    /**
     * {@inheritDoc}
     *
     * <p>Each entry of the results service's list is read as its string form.</p>
     *
     * @return the names, or empty when the results service answers with no body
     * @throws ResultsServiceUnavailableException if the results service is down or failing
     */
    @Override
    public Optional<List<String>> loadGameNames(String state) {
        List<?> names = webClient.get()
                .uri(resultsService.url(STATE_GAMES_PATH), state)
                .retrieve()
                .bodyToMono(List.class)
                .onErrorMap(ResultsServiceFailures::isUnavailable, ResultsServiceUnavailableException::new)
                .block();

        return Optional.ofNullable(names).map(list -> list.stream().map(Object::toString).toList());
    }

    private static StateCatalog toStateCatalog(LotteryState state) {
        String stateName = state.getStateRegion();
        List<Game> games = state.getStateLotteryGames() == null
                ? List.of()
                : state.getStateLotteryGames().stream()
                        .filter(game -> game != null && game.getFullName() != null)
                        .map(game -> ResultsServiceGames.toGame(new GameId(stateName, game.getFullName()), game))
                        .toList();
        return new StateCatalog(stateName, games);
    }
}
