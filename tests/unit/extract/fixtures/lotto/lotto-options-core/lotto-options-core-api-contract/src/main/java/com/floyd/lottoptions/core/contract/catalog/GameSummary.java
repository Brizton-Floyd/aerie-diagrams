package com.floyd.lottoptions.core.contract.catalog;

/**
 * One game in the catalog response.
 *
 * @param gameName  the game's full name (for example "Cash Five")
 * @param minNumber the smallest number of the game's field; {@code 1} when unknown
 * @param maxNumber the largest number of the game's field; {@code 1} when unknown
 * @param pickCount the numbers drawn per play (5 for Cash Five); {@code 0} when unknown (FR-018-A)
 */
public record GameSummary(String gameName, int minNumber, int maxNumber, int pickCount) {}
