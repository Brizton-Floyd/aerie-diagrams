package com.floyd.lottoptions.core.domain.catalog;

import com.floyd.lottoptions.core.domain.game.Game;

import java.util.List;
import java.util.Objects;

/**
 * One state's entry in the catalog: the state and the games it runs.
 *
 * @param state the state's name, the same as every game's {@code id().state()}
 * @param games the state's games, in the source's order
 */
public record StateCatalog(String state, List<Game> games) {

    public StateCatalog {
        Objects.requireNonNull(state, "state");
        games = List.copyOf(games);
        for (Game game : games) {
            if (!game.id().state().equals(state)) {
                throw new IllegalArgumentException(
                        "Game " + game.id() + " is not in state " + state);
            }
        }
    }
}
