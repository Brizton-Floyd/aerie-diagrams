package com.floyd.lottoptions.core.domain.betslip;

import java.util.List;
import java.util.Objects;
import java.util.OptionalInt;

/**
 * One play on a betslip: the numbers to mark in one play panel, and the bonus number to mark,
 * if any.
 *
 * @param numbers the main numbers, in the order given; a number the slip has no box for is
 *                not marked
 * @param bonus   the bonus number (for example the Powerball), or empty to mark none
 */
public record BetslipPlay(List<Integer> numbers, OptionalInt bonus) {

    public BetslipPlay {
        numbers = List.copyOf(numbers);
        Objects.requireNonNull(bonus, "bonus");
    }
}
