package com.floyd.lottoptions.core.server.adapter.resultsservice;

import com.floyd.lottoptions.config.PersistenceServiceProperties;
import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.draw.DrawHistorySource;
import com.floyd.lottoptions.core.domain.draw.DrawHistoryUnavailableException;
import com.floyd.lottoptions.core.domain.draw.UnknownGameException;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.persistence.model.LotteryDraw;
import com.floyd.persistence.model.LotteryGame;
import com.floyd.persistence.model.request.StateGameAnalysisRequest;
import com.floyd.persistence.model.response.StateGamesResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.List;
import java.util.Optional;

/**
 * Reads a game's draw history from the results service ({@code POST} to its draw-history
 * endpoint, {@code persistence-service.games}). The one place that maps the results service's
 * {@link StateGamesResponse} and {@link LotteryDraw}; the game is mapped by
 * {@link ResultsServiceGames} and keeps the requested {@link GameId}.
 *
 * <p>A 404 throws {@link UnknownGameException}; a failed or timed-out connection or a 5xx throws
 * {@link DrawHistoryUnavailableException}; other failures propagate unchanged.</p>
 */
@Component
public class ResultsServiceDrawHistoryAdapter implements DrawHistorySource {

    private static final Logger log = LoggerFactory.getLogger(ResultsServiceDrawHistoryAdapter.class);

    private final WebClient webClient;
    private final PersistenceServiceProperties resultsService;

    /**
     * @param webClient      the client every results-service call goes through
     * @param resultsService the results-service settings the request URL is built from
     */
    public ResultsServiceDrawHistoryAdapter(WebClient webClient, PersistenceServiceProperties resultsService) {
        this.webClient = webClient;
        this.resultsService = resultsService;
    }

    /**
     * {@inheritDoc}
     *
     * @return the history, or empty when the results service answers with no body or no game
     */
    @Override
    public Optional<DrawHistory> load(GameId game) {
        String uri = resultsService.drawHistoryUrl();
        log.debug("Fetching draw history of {} from persistence service: POST {}", game, uri);

        StateGameAnalysisRequest request = new StateGameAnalysisRequest();
        request.setStateName(game.state());
        request.setGameName(game.game());

        StateGamesResponse response = webClient.post()
                .uri(uri)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(StateGamesResponse.class)
                .onErrorMap(WebClientResponseException.NotFound.class, e -> new UnknownGameException(game, e))
                .onErrorMap(ResultsServiceFailures::isUnavailable, DrawHistoryUnavailableException::new)
                .block();

        if (response == null || response.getLotteryGame() == null) {
            log.warn("Persistence service returned no game for {} from {}", game, uri);
            return Optional.empty();
        }
        LotteryGame lotteryGame = response.getLotteryGame();
        return Optional.of(new DrawHistory(ResultsServiceGames.toGame(game, lotteryGame), draws(lotteryGame)));
    }

    private static List<Draw> draws(LotteryGame game) {
        return game.getLotteryDraws() == null
                ? List.of()
                : game.getLotteryDraws().stream()
                        .map(draw -> new Draw(draw.getDrawDate(), draw.getDrawResults()))
                        .toList();
    }
}
