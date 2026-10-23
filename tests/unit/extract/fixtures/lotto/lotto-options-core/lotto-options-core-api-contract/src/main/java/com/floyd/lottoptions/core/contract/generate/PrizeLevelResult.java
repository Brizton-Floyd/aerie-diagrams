package com.floyd.lottoptions.core.contract.generate;

/**
 * How the generated tickets would have fared at one prize level over the draw history.
 *
 * @param correctNumbers               the prize level: its correct numbers
 * @param hits                         how many times, over all draws, a ticket matched exactly
 *                                     that many
 * @param gamesOut                     how many draws since a ticket last did
 * @param expectedElapsedDaysBeforeWin the expected days before the tickets win this level,
 *                                     rounded to two decimals
 */
public record PrizeLevelResult(int correctNumbers, int hits, int gamesOut, double expectedElapsedDaysBeforeWin) {}
