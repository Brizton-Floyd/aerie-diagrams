package com.floyd.lottoptions.core.domain.generate;

/**
 * How a set of tickets fared at one prize level over a draw history.
 *
 * @param correctNumbers the prize level: how many of a ticket's numbers a draw matched
 * @param hits           how many times, over all draws, a ticket matched exactly that many
 * @param gamesOut       how many draws since a ticket last matched exactly that many, at most
 *                       the number of draws
 */
public record PrizeLevel(int correctNumbers, int hits, int gamesOut) {
}
