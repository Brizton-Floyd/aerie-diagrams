package com.floyd.lottoptions.core.domain.draw;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * One draw of a game: its date and the numbers drawn.
 *
 * @param date    the draw's date
 * @param numbers the numbers drawn, in the order the source lists them; for a digit game, the
 *                digit drawn at each position, first position first
 */
public record Draw(LocalDate date, List<Integer> numbers) {

    public Draw {
        Objects.requireNonNull(date, "date");
        numbers = List.copyOf(Objects.requireNonNull(numbers, "numbers"));
    }
}
