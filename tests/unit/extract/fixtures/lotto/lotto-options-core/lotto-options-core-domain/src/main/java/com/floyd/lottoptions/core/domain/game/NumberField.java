package com.floyd.lottoptions.core.domain.game;

/**
 * The range of numbers a game draws from, both ends included: 1-35 for Cash Five, 0-9 for a
 * digit game.
 *
 * @param min the smallest number
 * @param max the largest number
 */
public record NumberField(int min, int max) {
}
