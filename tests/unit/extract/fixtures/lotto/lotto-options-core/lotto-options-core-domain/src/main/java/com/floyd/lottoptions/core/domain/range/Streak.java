package com.floyd.lottoptions.core.domain.range;

/**
 * A range's current streak: the run of draws, from the latest back, that all hit it or all
 * missed it.
 *
 * @param hot   whether the latest draw hit the range
 * @param draws the draws in the run; {@code 0} when there are no draws
 */
public record Streak(boolean hot, int draws) {
}
