package com.floyd.lottoptions.bff.controller;

import com.floyd.lottoptions.bff.service.CatalogService;
import com.floyd.lottoptions.bff.viewmodel.StateCatalogViewModel;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * BFF endpoint that exposes the States-to-Games catalog for the Angular
 * {@code StateGamePickerComponent} (FR-008-G, ADR-0003, AC-4, AC-7).
 *
 * <p>Exposes a single endpoint:</p>
 * <ul>
 *   <li>{@code GET /ui/catalog/states} - returns the full catalog as a
 *       {@link StateCatalogViewModel} by delegating to {@link CatalogService}.</li>
 * </ul>
 *
 * <p>This controller holds no domain logic - all orchestration is in
 * {@link CatalogService} and all projection is in the assembler layer.
 * The controller's sole responsibility is HTTP routing (Effective Java Item 17).</p>
 *
 * <p>Constructor injection is used throughout; no field {@code @Autowired}
 * (Effective Java Item 5).</p>
 */
@Tag(name = "Catalog", description = "States-to-Games catalog endpoint for the picker (FR-008)")
@RestController
@RequestMapping("/ui")
public class CatalogController {

    private final CatalogService catalogService;

    /**
     * Constructs a {@code CatalogController} with its required service.
     *
     * @param catalogService the orchestration service for the catalog
     */
    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    /**
     * Returns the full States-to-Games catalog for the picker.
     *
     * <p>Issues exactly one Core API call per invocation via {@link CatalogService}.
     * The payload is small (&lt; 50 KB per AC-11) and contains state names and game
     * summaries only - no draw history. FR-009 Angular app consumes this endpoint
     * for the {@code StateGamePickerComponent}.</p>
     *
     * @return a {@link Mono} emitting the {@link StateCatalogViewModel} with HTTP 200
     */
    @Operation(
            summary = "Get States-to-Games catalog",
            description = "Returns the full catalog of lottery states and their games for the " +
                    "cascading picker. No draw history included. Payload target < 50 KB. " +
                    "Issues exactly one Core API call. Used by FR-009 StateGamePickerComponent.")
    @GetMapping("/catalog/states")
    public Mono<StateCatalogViewModel> getCatalogStates() {
        return catalogService.getCatalog();
    }
}
