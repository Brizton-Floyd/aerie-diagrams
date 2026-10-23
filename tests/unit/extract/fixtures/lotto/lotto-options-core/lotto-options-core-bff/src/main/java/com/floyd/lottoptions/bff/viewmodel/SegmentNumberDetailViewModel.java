package com.floyd.lottoptions.bff.viewmodel;

/**
 * Per-number detail within a pool segment (FR-011-B).
 *
 * <p>Reports the current games-out value and the heat zone for one lottery
 * number inside a segment.  Zone values follow the convention established in
 * {@code FrequencyRollupAssembler.classifyZone}: {@code "HOT"} (GO 0–9),
 * {@code "WARM"} (GO 10–19), {@code "COLD"} (GO 20+).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param number   the lottery ball number
 * @param gamesOut the current games-out value derived from the most-recent draw
 * @param heatZone the heat zone string: {@code "HOT"}, {@code "WARM"}, or {@code "COLD"}
 */
public record SegmentNumberDetailViewModel(
        int number,
        int gamesOut,
        String heatZone
) {}
