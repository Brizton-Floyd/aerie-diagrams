package com.floyd.lottoptions.core.contract.game;

/**
 * A game's rules as the dashboard screens read them: the field they lay out and the numbers a
 * draw hits. For a pick-k game the field and pick count are the game's own; for a digit game the
 * field is the position-encoded 0-39 and the pick count is the game's positions.
 *
 * @param fieldMin  the smallest number of the field
 * @param fieldMax  the largest number of the field
 * @param pickCount the numbers the latest draw hit
 * @param format    the game's pick count and the largest number of its own field, as
 *                  {@code pickCount/max} (for example {@code 5/35})
 */
public record GameRules(int fieldMin, int fieldMax, int pickCount, String format) {}
