package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Paged draw-history matrix response for {@code GET /ui/dashboard/{state}/{game}/matrix}.
 *
 * <p>The server slices the full history (oldest-first internally) using
 * {@code [endIndex-size, endIndex)} and reverses it to newest-first for delivery.
 * {@code hasOlder} / {@code hasNewer} let the Angular component enable/disable the
 * {@code <} / {@code >} time-navigation arrows without knowing {@code totalDraws}
 * independently (FR-006-C, ADR-0003).</p>
 *
 * <p>Design note (Effective Java Item 2): this record has 8 components. Records are
 * the BFF standard (ADR-0003); the 7-point audit (FR-006 Section 1.3) documents this
 * decision.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param totalDraws  total rows available (for client scrollbar extent)
 * @param fieldMin    inclusive minimum column number
 * @param fieldMax    inclusive maximum column number
 * @param pageSize    actual rows returned in this page (may be less than requested)
 * @param endIndex    0-based exclusive end index into the full oldest-first history list
 * @param hasOlder    true if there are older pages (endIndex - pageSize > 0)
 * @param hasNewer    true if there are newer pages (endIndex < totalDraws)
 * @param rows        the draw rows, newest-first within this page
 */
public record MatrixPageViewModel(
        int                      totalDraws,
        int                      fieldMin,
        int                      fieldMax,
        int                      pageSize,
        int                      endIndex,
        boolean                  hasOlder,
        boolean                  hasNewer,
        List<MatrixRowViewModel> rows
) {}
