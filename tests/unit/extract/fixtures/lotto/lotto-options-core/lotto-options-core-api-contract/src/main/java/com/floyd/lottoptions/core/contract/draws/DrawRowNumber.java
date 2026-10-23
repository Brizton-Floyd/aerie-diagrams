package com.floyd.lottoptions.core.contract.draws;

/**
 * One number's games out after a draw of a draw page.
 *
 * @param number   the number
 * @param gamesOut the draws since the number last hit: {@code 0} when the draw hit it
 */
public record DrawRowNumber(int number, int gamesOut) {}
