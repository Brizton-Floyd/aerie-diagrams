package com.floyd.lottoptions.bff.client;

import com.floyd.lottoptions.core.contract.betslip.BetslipPdfRequest;
import com.floyd.lottoptions.core.contract.catalog.CatalogStatesResponse;
import com.floyd.lottoptions.core.contract.generate.GeneratedNumberData;
import com.floyd.lottoptions.core.contract.generate.RandomNumberGeneratorRequest;
import com.floyd.lottoptions.core.contract.dashboard.DashboardResponse;
import com.floyd.lottoptions.core.contract.draws.DrawPage;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.codec.json.JacksonJsonDecoder;
import org.springframework.http.codec.json.JacksonJsonEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;

import com.floyd.lottoptions.bff.config.CoreApiPropertiesConfig;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

/**
 * HTTP client for the Core API, backed by a {@link WebClient} pre-configured with a
 * 20 MB in-memory codec buffer.
 *
 * <p>The 20 MB headroom prevents {@code DataBufferLimitException} for the Core API's
 * dashboard endpoint whose payload currently reaches ~7.6 MB for large game histories
 * (Story 1 / FR-004). New endpoint methods are added here as new BFF stories require
 * them; each method returns a reactive {@link Mono} - no {@code block()} calls are
 * permitted (FR-006 Section 1.1 constraint (a)).</p>
 *
 * <p>Error contract: a Core 404 fails the call with {@link CoreNotFoundException}, and a
 * Core 503 or an unreachable Core with {@link CoreUnavailableException}, each carrying
 * Core's problem detail when it sent one. Other non-2xx responses propagate as
 * {@code WebClientResponseException}.</p>
 *
 * <p>Constructor injection is used throughout (Effective Java Item 5). No field
 * {@code @Autowired}.</p>
 */
@Component
public final class CoreApiClient {

    /** 20 MB - generous headroom above the current ~7.6 MB dashboard payload. */
    private static final int MAX_IN_MEMORY_SIZE_BYTES = 20 * 1024 * 1024;

    static final String NOT_FOUND_DETAIL = "The Core API found no such resource";
    static final String UNAVAILABLE_DETAIL = "The Core API is unavailable";
    static final String UNREACHABLE_DETAIL = "The Core API is unreachable";

    private final WebClient webClient;

    /**
     * Builds a {@link WebClient} bound to the Core API base URL with a 20 MB
     * codec buffer and the class's error contract. The base URL is externalized via
     * {@link CoreApiPropertiesConfig}. The JSON codecs use the Boot-managed mapper, so Core
     * requests and responses follow the {@code spring.jackson} settings; Spring's default
     * codecs would build their own mapper with plain Jackson 3 defaults.
     *
     * @param coreApiProperties validated configuration holding the Core API base URL
     * @param jsonMapper the Boot-managed JSON mapper
     */
    public CoreApiClient(CoreApiPropertiesConfig coreApiProperties, JsonMapper jsonMapper) {
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(configurer -> {
                    configurer.defaultCodecs().jacksonJsonDecoder(new JacksonJsonDecoder(jsonMapper));
                    configurer.defaultCodecs().jacksonJsonEncoder(new JacksonJsonEncoder(jsonMapper));
                    configurer.defaultCodecs().maxInMemorySize(MAX_IN_MEMORY_SIZE_BYTES);
                })
                .build();

        this.webClient = WebClient.builder()
                .baseUrl(coreApiProperties.baseUrl())
                .exchangeStrategies(strategies)
                .defaultStatusHandler(status -> isStatus(status, HttpStatus.NOT_FOUND),
                        response -> problemDetail(response, NOT_FOUND_DETAIL).map(CoreNotFoundException::new))
                .defaultStatusHandler(status -> isStatus(status, HttpStatus.SERVICE_UNAVAILABLE),
                        response -> problemDetail(response, UNAVAILABLE_DETAIL).map(CoreUnavailableException::new))
                .filter((request, next) -> next.exchange(request)
                        .onErrorMap(WebClientRequestException.class,
                                e -> new CoreUnavailableException(UNREACHABLE_DETAIL, e)))
                .build();
    }

    private static boolean isStatus(HttpStatusCode status, HttpStatus expected) {
        return status.value() == expected.value();
    }

    /** Core's problem detail from an error response, or {@code fallback} when it sent none. */
    private static Mono<String> problemDetail(ClientResponse response, String fallback) {
        return response.bodyToMono(ProblemDetail.class)
                .mapNotNull(ProblemDetail::getDetail)
                // An empty or non-problem body has no detail to keep; the status alone decides.
                .onErrorResume(e -> Mono.empty())
                .defaultIfEmpty(fallback);
    }

    /**
     * Returns the configured {@link WebClient} for use by BFF service classes.
     *
     * @return the pre-configured {@link WebClient} instance
     */
    public WebClient getWebClient() {
        return webClient;
    }

    /**
     * Fetches the full dashboard payload from the Core API for the given state and game.
     *
     * <p>Calls {@code GET /api/v1/analysis/{state}/{game}/dashboard} on the Core API
     * and deserializes the response body into a {@link DashboardResponse}. The 20 MB
     * codec buffer configured at construction is sufficient for the current payload size
     * (~7.6 MB).</p>
     *
     * <p>Errors from the Core API follow this client's error contract (see the class
     * comment) and are never swallowed.</p>
     *
     * @param state the lottery state code (e.g. {@code "TX"})
     * @param game  the lottery game name (e.g. {@code "Cash Five"})
     * @return a {@link Mono} emitting the {@link DashboardResponse}, or propagating
     *         any upstream error
     */
    public Mono<DashboardResponse> getDashboard(String state, String game) {
        return webClient.get()
                .uri("/api/v1/analysis/{state}/{game}/dashboard", state, game)
                .retrieve()
                .bodyToMono(DashboardResponse.class);
    }

    /**
     * Fetches one page of a game's draw history, each draw with the games out after it, and the
     * game's rules.
     *
     * <p>Calls {@code GET /api/v1/analysis/{state}/{game}/draws?endIndex&size} on the Core API
     * and deserializes the response body into a {@link DrawPage}. Indexes count the draws
     * oldest first, from {@code 0}.</p>
     *
     * <p>Errors from the Core API follow this client's error contract (see the class
     * comment) and are never swallowed.</p>
     *
     * @param state    the lottery state code (e.g. {@code "TX"})
     * @param game     the lottery game name (e.g. {@code "Cash Five"})
     * @param endIndex the index just past the page's latest draw; negative asks for the latest
     *                 page, and leaves the parameter out
     * @param size     the most draws the page holds
     * @return a {@link Mono} emitting the {@link DrawPage}, or propagating any upstream error
     */
    public Mono<DrawPage> getDraws(String state, String game, int endIndex, int size) {
        return webClient.get()
                .uri(uri -> {
                    uri.path("/api/v1/analysis/{state}/{game}/draws");
                    if (endIndex >= 0) {
                        uri.queryParam("endIndex", endIndex);
                    }
                    return uri.queryParam("size", size).build(state, game);
                })
                .retrieve()
                .bodyToMono(DrawPage.class);
    }

    /**
     * Submits a number-generation request to the Core API (FR-013-CLIENT).
     *
     * <p>Calls {@code POST /api/v1/analysis/generate/numbers} on the Core API, sending
     * the {@link RandomNumberGeneratorRequest} as a JSON body, and deserializes the
     * response into a {@link GeneratedNumberData}. Spring WebFlux's {@link WebClient}
     * serializes the body via Jackson automatically with {@code Content-Type: application/json}.</p>
     *
     * <p>The existing 20 MB codec buffer is more than sufficient for generation payloads,
     * which are small in comparison to the dashboard payload.</p>
     *
     * <p>Errors from the Core API follow this client's error contract (see the class
     * comment) and are never swallowed. No {@code block()} is called; the reactive chain is preserved
     * end-to-end (FR-013 Section 1.2 constraint 2).</p>
     *
     * @param request the fully-populated generation request to forward to the Core API;
     *                must not be {@code null}
     * @return a {@link Mono} emitting the {@link GeneratedNumberData}, or propagating
     *         any upstream error
     */
    public Mono<GeneratedNumberData> generateNumbers(RandomNumberGeneratorRequest request) {
        return webClient.post()
                .uri("/api/v1/analysis/generate/numbers")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(GeneratedNumberData.class);
    }

    /**
     * Fetches the States-to-Games catalog from the Core API (FR-008-F).
     *
     * <p>Calls {@code GET /api/v1/catalog/states} on the Core API and deserializes
     * the response into a {@link CatalogStatesResponse}. The catalog is small (target
     * &lt; 50 KB per AC-11) so the 20 MB codec buffer is never approached.</p>
     *
     * <p>Errors from the Core API follow this client's error contract (see the class
     * comment) and are never swallowed.</p>
     *
     * @return a {@link Mono} emitting the {@link CatalogStatesResponse}, or propagating
     *         any upstream error
     */
    public Mono<CatalogStatesResponse> getCatalogStates() {
        return webClient.get()
                .uri("/api/v1/catalog/states")
                .retrieve()
                .bodyToMono(CatalogStatesResponse.class);
    }

    /**
     * Submits a range-analysis request to the Core API (FR-016-A).
     *
     * <p>Calls {@code POST /api/v1/analysis/range-analysis} on the Core API and
     * deserializes the response body into a {@link RangeAnalysisResponse}. The existing
     * 20 MB codec buffer is more than sufficient for range-analysis payloads (target
     * &lt; 200 KB per FR-016 NFR). No codec reconfiguration is needed.</p>
     *
     * <p>No {@code block()} is called; the reactive chain is preserved end-to-end
     * (FR-016 Section 1.1 constraint (a)).</p>
     *
     * <p>Errors from the Core API follow this client's error contract (see the class
     * comment) and are never swallowed.</p>
     *
     * <p>Note: {@code null}-guarding of the {@code request} parameter is enforced upstream
     * in {@link com.floyd.lottoptions.bff.service.RangeAnalysisService} - consistent with
     * the existing {@link #generateNumbers} pattern on this client.</p>
     *
     * @param request the fully-populated range-analysis request to forward to the Core API
     * @return a {@link Mono} emitting the {@link RangeAnalysisResponse}, or propagating
     *         any upstream error
     */
    public Mono<RangeAnalysisResponse> getRangeAnalysis(RangeAnalysisRequest request) {
        return webClient.post()
                .uri("/api/v1/analysis/range-analysis")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(RangeAnalysisResponse.class);
    }

    /**
     * Forwards a betslip PDF generation request to the Core API (FR-014-006).
     *
     * <p>Calls {@code POST /api/v1/betslip/pdf} on the Core API and returns the raw
     * PDF bytes as a {@link Mono}{@code <byte[]>}. No {@code block()} is used;
     * the reactive chain is preserved end-to-end.</p>
     *
     * <p>Errors from the Core API follow this client's error contract (see the class
     * comment) and are never swallowed.</p>
     *
     * @param request the fully-populated Core API betslip PDF request
     * @return a {@link Mono} emitting the raw PDF bytes
     */
    public Mono<byte[]> generateBetslipPdf(BetslipPdfRequest request) {
        return webClient.post()
                .uri("/api/v1/betslip/pdf")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(byte[].class);
    }
}
