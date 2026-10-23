package com.floyd.lottoptions.core.domain.gamesout;

/**
 * One number's games out after a draw.
 *
 * @param number   the number
 * @param gamesOut the draws since the number last hit: {@code 0} when the draw hit it
 */
public record NumberGamesOut(int number, int gamesOut) {
}
