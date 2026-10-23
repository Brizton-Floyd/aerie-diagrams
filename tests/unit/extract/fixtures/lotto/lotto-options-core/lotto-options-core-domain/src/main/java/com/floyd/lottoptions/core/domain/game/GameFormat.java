package com.floyd.lottoptions.core.domain.game;

/**
 * How a game draws its numbers (ADR-0007).
 *
 * <p>The results-service adapter derives it once per game, from the game's field; nothing else
 * derives it again.</p>
 */
public enum GameFormat {

    /** Draws k distinct numbers from the field, for example Cash Five's 5 of 1-35. */
    PICK_K,

    /** Draws one digit 0-9 per position, digits may repeat, for example Pick 3. */
    DIGIT
}
