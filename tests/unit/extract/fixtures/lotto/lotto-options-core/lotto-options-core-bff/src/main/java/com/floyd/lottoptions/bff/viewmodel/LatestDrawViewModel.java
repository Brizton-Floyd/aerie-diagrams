package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * The most recent draw's result - date label and the ordered drawn balls (FR-008-H).
 *
 * <p>Used by the Angular stat-strip dark card ({@code DrawBallComponent}) to render
 * the colored position balls (ball 1 = red, ball 2 = blue, ball 3 = green, …).</p>
 *
 * <p>The {@code balls} list is ordered by ball position (ascending) and contains
 * only the numbers that were actually drawn ({@code gamesOut == 0}) in column order
 * - see {@link com.floyd.lottoptions.bff.assembler.LatestDrawAssembler}.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param drawDate the draw date label string (e.g. "Jun 12, 2026") as returned by Core
 * @param balls    ordered list of drawn balls; never {@code null}, may be empty
 */
public record LatestDrawViewModel(String drawDate, List<DrawnBallViewModel> balls) {}
