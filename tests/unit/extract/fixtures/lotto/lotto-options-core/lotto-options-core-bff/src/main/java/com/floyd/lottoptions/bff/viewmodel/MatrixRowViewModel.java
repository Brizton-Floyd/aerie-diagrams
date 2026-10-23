package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * One row in the draw-history matrix - one draw, one cell per number in field.
 *
 * <p>Mirrors the desktop's {@code dateColumnTable} + {@code numberColumnsTable}
 * row pairing (DashBoardController.java:233–264, FR-006-C, ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param drawDate the draw date string from {@code DrawResultPattern.drawDate}
 * @param cells    one {@link MatrixCellViewModel} per number in fieldMin..fieldMax
 */
public record MatrixRowViewModel(
        String                    drawDate,
        List<MatrixCellViewModel> cells
) {}
