package com.floyd.lottoptions.legacy.desktop.config;

import com.floyd.lottoptions.legacy.desktop.generation.engine.MasterGenerationEngine;
import com.floyd.lottoptions.legacy.desktop.grouping.HttpLotteryPersistenceClient;
import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;
import com.floyd.lottoptions.legacy.desktop.service.adapter.LotteryDataServiceAdapter;
import com.floyd.lottoptions.legacy.desktop.shared.service.LotteryStateService;
import com.floyd.lottoptions.legacy.desktop.shared.service.ResultsServiceLocation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;
import tools.jackson.databind.json.JsonMapper;

/**
 * Wires the legacy desktop code: the v2 ticket generator and the games endpoints. It reads
 * the results service's location from Core's {@code persistence-service} keys and takes
 * Core's shared results-service {@link WebClient}, since legacy cannot depend on Core.
 */
@Configuration
public class LegacyDesktopConfiguration {

    /** Request timeout for the persistence client, in milliseconds. */
    private static final int PERSISTENCE_TIMEOUT_MILLIS = 5000;

    /** Maximum retry attempts for failed persistence requests. */
    private static final int PERSISTENCE_MAX_RETRY_ATTEMPTS = 3;

    private final ResultsServiceLocation resultsService;

    /**
     * @param host  the results service's base URL ({@code persistence-service.host})
     * @param games the draw-history path ({@code persistence-service.games})
     */
    public LegacyDesktopConfiguration(@Value("${persistence-service.host}") String host,
                                      @Value("${persistence-service.games}") String games) {
        this.resultsService = new ResultsServiceLocation(host, games);
    }

    /**
     * The results-service reads of the v2 generator and the games endpoints.
     *
     * @param webClient  Core's shared results-service web client
     * @param jsonMapper the Boot-managed JSON mapper, used to log request payloads
     * @return the legacy lottery state service
     */
    @Bean
    public LotteryStateService legacyLotteryStateService(WebClient webClient, JsonMapper jsonMapper) {
        return new LotteryStateService(webClient, jsonMapper, resultsService);
    }

    /**
     * Persistence client for the generation engine, wired to the same results-service
     * host the rest of Core uses instead of a hardcoded URL. The client resolves its
     * {@code /api/...} paths against the base URL, so a host with or without a
     * trailing slash yields the same request URLs.
     *
     * @param jsonMapper the Boot-managed JSON mapper for the client's codecs
     * @return the HTTP persistence client
     */
    @Bean
    public LotteryPersistenceClient lotteryPersistenceClient(JsonMapper jsonMapper) {
        return new HttpLotteryPersistenceClient(resultsService.url(""), PERSISTENCE_TIMEOUT_MILLIS,
                PERSISTENCE_MAX_RETRY_ATTEMPTS, jsonMapper);
    }

    /**
     * Ticket generation engine built from the persistence client and the legacy lottery
     * state service, adapted to the engine's contract.
     *
     * @param lotteryPersistenceClient the persistence client bean
     * @param legacyLotteryStateService the legacy lottery state service
     * @return the master generation engine
     */
    @Bean
    public MasterGenerationEngine masterGenerationEngine(LotteryPersistenceClient lotteryPersistenceClient,
                                                         LotteryStateService legacyLotteryStateService) {
        return new MasterGenerationEngine(lotteryPersistenceClient,
                new LotteryDataServiceAdapter(legacyLotteryStateService));
    }
}
