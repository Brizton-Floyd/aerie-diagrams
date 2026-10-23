package com.floyd.lottoptions.bff.viewmodel;

/**
 * A single drawn ball from the latest draw result, with its 1-based position
 * within the draw (FR-008-H).
 *
 * <p>Position is determined by the order of appearance in the sorted
 * {@code lotteryNumbers} list (column order in the draw matrix). Ball position
 * drives the color used by {@code DrawBallComponent} in the Angular stat strip
 * (red for ball 1, blue for ball 2, etc.).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param position 1-based position of this ball in the draw (1 = first drawn number)
 * @param number   the lottery number that was drawn
 */
public record DrawnBallViewModel(int position, int number) {}
