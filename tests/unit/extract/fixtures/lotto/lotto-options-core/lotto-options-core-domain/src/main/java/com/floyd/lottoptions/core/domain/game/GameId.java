package com.floyd.lottoptions.core.domain.game;

import java.util.Objects;

/**
 * Names one game: the {@code {state}/{game}} pair every Core API path uses.
 *
 * @param state the state's name as the results service spells it (for example {@code Texas})
 * @param game  the game's full name (for example {@code Cash Five})
 */
public record GameId(String state, String game) {

    public GameId {
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(game, "game");
    }
}
