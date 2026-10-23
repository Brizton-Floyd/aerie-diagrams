package com.floyd.lottoptions.core.domain.game;

import java.util.Objects;

/**
 * A lottery game as Core knows it.
 *
 * @param id        the game's state and name
 * @param format    how the game draws its numbers
 * @param field     the numbers the game draws from; {@code 1-1} when the results service does not
 *                  know them
 * @param pickCount the numbers drawn per play: 5 for Cash Five, 3 for Pick 3; {@code 0} when the
 *                  results service does not know it
 */
public record Game(GameId id, GameFormat format, NumberField field, int pickCount) {

    public Game {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(format, "format");
        Objects.requireNonNull(field, "field");
    }
}
