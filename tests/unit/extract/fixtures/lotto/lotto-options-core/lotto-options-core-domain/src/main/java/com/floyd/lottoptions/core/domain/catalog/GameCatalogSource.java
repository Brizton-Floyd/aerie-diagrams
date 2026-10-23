package com.floyd.lottoptions.core.domain.catalog;

import java.util.List;
import java.util.Optional;

/**
 * Where the catalog comes from. Core's adapter reads it from the results service. When the
 * source cannot be read, the implementation throws its own unchecked exception, which the web
 * adapter maps.
 */
public interface GameCatalogSource {

    /**
     * Loads the whole catalog.
     *
     * @return the catalog, or empty when the source answered without one
     */
    Optional<Catalog> load();

    /**
     * Loads the names of one state's games, in the order the source lists them for that state,
     * which need not be the catalog's order.
     *
     * @param state the state's name (for example {@code Texas})
     * @return the games' full names, or empty when the source answered without a list
     */
    Optional<List<String>> loadGameNames(String state);
}
