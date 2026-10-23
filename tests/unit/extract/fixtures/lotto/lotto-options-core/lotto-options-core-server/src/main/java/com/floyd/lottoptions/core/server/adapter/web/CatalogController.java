package com.floyd.lottoptions.core.server.adapter.web;

import com.floyd.lottoptions.core.application.catalog.ListCatalog;
import com.floyd.lottoptions.core.contract.catalog.CatalogStatesResponse;
import com.floyd.lottoptions.core.contract.catalog.GameSummary;
import com.floyd.lottoptions.core.contract.catalog.StateGamesSummary;
import com.floyd.lottoptions.core.domain.catalog.Catalog;
import com.floyd.lottoptions.core.domain.catalog.StateCatalog;
import com.floyd.lottoptions.core.domain.game.Game;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Core API endpoint for the catalog, every state and its games (FR-008-A). Draw history is
 * not included (AC-10, AC-11).
 *
 * <p>A down or failing results service answers 503 through
 * {@code com.floyd.lottoptions.controller.LiveApiExceptionHandler}.</p>
 */
@RestController
@RequestMapping("/api/v1")
public class CatalogController {

    private static final Logger log = LoggerFactory.getLogger(CatalogController.class);

    private final ListCatalog listCatalog;

    /**
     * @param listCatalog the use case that lists the catalog
     */
    public CatalogController(ListCatalog listCatalog) {
        this.listCatalog = listCatalog;
    }

    /**
     * Returns the catalog for the game picker.
     *
     * @return 200 with the catalog; 502 when the results service answered without one
     */
    @GetMapping("/catalog/states")
    public ResponseEntity<CatalogStatesResponse> getCatalogStates() {
        log.debug("Received request: GET /api/v1/catalog/states");
        return listCatalog.list()
                .map(catalog -> {
                    log.debug("Returning catalog with {} states", catalog.states().size());
                    return ResponseEntity.ok(toResponse(catalog));
                })
                .orElseGet(() -> {
                    log.warn("Catalog unavailable - persistence service returned no data");
                    return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
                });
    }

    private static CatalogStatesResponse toResponse(Catalog catalog) {
        return new CatalogStatesResponse(catalog.states().stream().map(CatalogController::toSummary).toList());
    }

    private static StateGamesSummary toSummary(StateCatalog state) {
        return new StateGamesSummary(state.state(), state.games().stream().map(CatalogController::toSummary).toList());
    }

    private static GameSummary toSummary(Game game) {
        return new GameSummary(game.id().game(), game.field().min(), game.field().max(), game.pickCount());
    }
}
