package com.floyd.lottoptions.bff.viewmodel;

/**
 * Per-range-of-10 summary for the Games-Out Frequency panel header.
 *
 * <p>Mirrors the desktop's per-range box header that shows
 * {@code Range X-Y} with hot/warm/cold counts (DashBoardController.java:461–471,
 * FR-006-C, ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param rangeStart inclusive lower bound (e.g. 1, 11, 21, 31)
 * @param rangeEnd   inclusive upper bound (e.g. 10, 20, 30, 40)
 * @param hotCount   numbers in HOT zone (GO 0–9) within this range
 * @param warmCount  numbers in WARM zone (GO 10–19) within this range
 * @param coldCount  numbers in COLD zone (GO 20+) within this range
 */
public record RangeRollupViewModel(
        int rangeStart,
        int rangeEnd,
        int hotCount,
        int warmCount,
        int coldCount
) {}
