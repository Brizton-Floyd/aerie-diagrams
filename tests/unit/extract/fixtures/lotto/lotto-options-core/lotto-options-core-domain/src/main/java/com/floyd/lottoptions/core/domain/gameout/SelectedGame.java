package com.floyd.lottoptions.core.domain.gameout;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * A game picked for a multi-game play, in play order, as the wagering strategy sees it.
 *
 * @param gameId    the game's name
 * @param totalCost what playing the game costs, {@code 0} when it has no cost
 */
public record SelectedGame(String gameId, BigDecimal totalCost) {

    public SelectedGame {
        Objects.requireNonNull(gameId, "gameId");
        Objects.requireNonNull(totalCost, "totalCost");
    }
}
