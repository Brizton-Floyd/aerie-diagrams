package com.floyd.lottoptions.core.contract.dashboard;

/**
 * One number's games out after a draw.
 *
 * @param number   the number
 * @param gamesOut the draws since the number last hit: {@code 0} when the draw hit it
 */
public record LotteryNumber(int number, int gamesOut) {}
