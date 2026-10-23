package com.floyd.lottoptions.core.contract.catalog;

import java.util.List;

/**
 * Response body of {@code GET /api/v1/catalog/states}: every state with its games, without draw
 * history.
 *
 * @param states the states, in the results service's order
 */
public record CatalogStatesResponse(List<StateGamesSummary> states) {}
