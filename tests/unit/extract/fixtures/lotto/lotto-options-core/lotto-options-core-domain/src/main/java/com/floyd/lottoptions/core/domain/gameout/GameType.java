package com.floyd.lottoptions.core.domain.gameout;

/**
 * Classifies a lottery game by how its numbers are analyzed for game-out patterns.
 *
 * <p>{@code DIGIT_BASED} games (e.g. Pick 3 / Pick 4) draw single digits 0-9 per
 * position and are analyzed on the digit itself. {@code LARGE_POOL} games draw
 * whole numbers from a wider range and are analyzed on each number's last digit.</p>
 *
 * <p>{@link PositionalPatternEngine#detectGameType(String)} derives it from the game's
 * name, not from the game's format: the two disagree on the All or Nothing games, which
 * the name rule calls digit-based, so the name rule stays until a bug fix replaces it.</p>
 */
public enum GameType {
    DIGIT_BASED,
    LARGE_POOL
}
