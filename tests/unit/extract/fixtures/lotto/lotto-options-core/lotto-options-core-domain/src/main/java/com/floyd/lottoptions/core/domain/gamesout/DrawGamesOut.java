package com.floyd.lottoptions.core.domain.gamesout;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * The games out of every number of the field, right after one draw.
 *
 * @param drawDate the draw's date
 * @param numbers  every number of the field with its games out, smallest number first
 */
public record DrawGamesOut(LocalDate drawDate, List<NumberGamesOut> numbers) {

    public DrawGamesOut {
        Objects.requireNonNull(drawDate, "drawDate");
        numbers = List.copyOf(numbers);
    }
}
