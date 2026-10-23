package com.floyd.lottoptions.bff.service;

import com.floyd.lottoptions.bff.assembler.CatalogAssembler;
import com.floyd.lottoptions.bff.client.CoreApiClient;
import com.floyd.lottoptions.bff.viewmodel.StateCatalogViewModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/**
 * Orchestration service for the States-to-Games catalog endpoint (FR-008-E, ADR-0003).
 *
 * <p>Issues exactly one Core API call per invocation via
 * {@link CoreApiClient#getCatalogStates()} and delegates projection to
 * {@link CatalogAssembler}. No domain logic lives here.</p>
 *
 * <p>The class is {@code final} because it is not designed for extension
 * (Effective Java Items 17 and 19). Constructor injection is used throughout;
 * no field {@code @Autowired} (Effective Java Item 5).</p>
 *
 * <p>No {@code block()} calls are made anywhere in the reactive chain - all
 * operations remain non-blocking (FR-006 Section 1.1 constraint (a), AC-2).</p>
 */
@Service
public final class CatalogService {

    private static final Logger log = LoggerFactory.getLogger(CatalogService.class);

    private final CoreApiClient coreApiClient;
    private final CatalogAssembler catalogAssembler;

    /**
     * Constructs a {@code CatalogService} with its required collaborators.
     *
     * @param coreApiClient    reactive HTTP client for the Core API
     * @param catalogAssembler assembles the Core API response into a view model
     */
    public CatalogService(CoreApiClient coreApiClient, CatalogAssembler catalogAssembler) {
        this.coreApiClient = coreApiClient;
        this.catalogAssembler = catalogAssembler;
    }

    /**
     * Fetches the States-to-Games catalog from the Core API and assembles it into
     * a {@link StateCatalogViewModel}.
     *
     * <p>Issues exactly one Core API call per invocation (FR-008-E). Errors from
     * the Core API propagate as {@link CoreApiClient} raises them.</p>
     *
     * @return a {@link Mono} emitting the {@link StateCatalogViewModel}
     */
    public Mono<StateCatalogViewModel> getCatalog() {
        log.debug("Fetching catalog from Core API");
        return coreApiClient.getCatalogStates()
                .map(coreResponse -> {
                    log.debug("Assembling catalog with {} states",
                            coreResponse.states() != null ? coreResponse.states().size() : 0);
                    return catalogAssembler.assemble(coreResponse);
                });
    }
}
