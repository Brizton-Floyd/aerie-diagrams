package com.floyd.lottoptions.core.domain.catalog;

import java.util.List;

/**
 * The catalog: every state Core can serve and the games each runs. It carries no draw history.
 *
 * @param states the states, in the source's order
 */
public record Catalog(List<StateCatalog> states) {

    public Catalog {
        states = List.copyOf(states);
    }
}
