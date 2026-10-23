package com.floyd.lottoptions.bff.viewmodel;

/**
 * One cell in the draw-history matrix grid.
 *
 * <p>Mirrors the desktop's per-cell map {@code {gamesOut, number, position?}}
 * (DashBoardController.java:207–229). {@code position} is the ONLY intentionally
 * nullable field in the BFF view-model design:
 * <ul>
 *   <li>{@code null} - this number did not hit in this draw ({@code gamesOut > 0})</li>
 *   <li>1-based integer - this number hit ({@code gamesOut == 0}) and was the Nth
 *       ball drawn in that draw (draw order determines color in the Angular matrix)</li>
 * </ul>
 * The nullable Integer is documented in Section 1.3 of FR-006 and in ADR-0003 as
 * intentional - it is semantically meaningful, not a null-collection smell.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param number   the lottery number this cell represents
 * @param gamesOut games-out count for (draw, number) pair; 0 means drawn this draw
 * @param position 1-based draw-order position if hit; {@code null} if not hit
 */
public record MatrixCellViewModel(
        int     number,
        int     gamesOut,
        Integer position
) {}
