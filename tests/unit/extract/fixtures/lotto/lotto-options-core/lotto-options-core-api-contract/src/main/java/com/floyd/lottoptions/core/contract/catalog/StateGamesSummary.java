package com.floyd.lottoptions.core.contract.catalog;

import java.util.List;

/**
 * One state in the catalog response.
 *
 * @param stateName the state's name (for example "Texas")
 * @param games     the games the state runs
 */
public record StateGamesSummary(String stateName, List<GameSummary> games) {}
