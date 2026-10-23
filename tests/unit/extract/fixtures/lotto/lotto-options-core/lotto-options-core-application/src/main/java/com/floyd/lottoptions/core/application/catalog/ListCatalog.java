package com.floyd.lottoptions.core.application.catalog;

import com.floyd.lottoptions.core.domain.catalog.Catalog;
import com.floyd.lottoptions.core.domain.catalog.GameCatalogSource;

import java.util.Objects;
import java.util.Optional;

/**
 * Use case: list the catalog, every state and its games, for the game picker.
 */
public final class ListCatalog {

    private final GameCatalogSource catalogSource;

    /**
     * @param catalogSource where the catalog is read from
     */
    public ListCatalog(GameCatalogSource catalogSource) {
        this.catalogSource = Objects.requireNonNull(catalogSource, "catalogSource");
    }

    /**
     * Lists the catalog.
     *
     * @return the catalog, or empty when the source answered without one
     */
    public Optional<Catalog> list() {
        return catalogSource.load();
    }
}
