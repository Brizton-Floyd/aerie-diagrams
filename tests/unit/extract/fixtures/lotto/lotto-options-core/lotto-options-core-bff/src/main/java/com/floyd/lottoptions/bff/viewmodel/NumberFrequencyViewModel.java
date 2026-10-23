package com.floyd.lottoptions.bff.viewmodel;

/**
 * Games-Out Frequency panel entry - one per number in the lottery field.
 *
 * <p>Provides full desktop parity with {@code setUpGamesOutFrequencyAnalysis}
 * (DashBoardController.java:438–489). Each field maps to a visual element in the
 * per-range box:
 * <ul>
 *   <li>{@code zone} - HOT (GO 0–9) / WARM (10–19) / COLD (20+), drives icon and color.</li>
 *   <li>{@code frequencyPercent} - {@code freq%} shown next to GO value.</li>
 *   <li>{@code rangeFrequency} - {@code [Nx]} how many times this GO transitioned to 0 in range.</li>
 *   <li>{@code drawsAgo} - {@code (Dd)} draws since last hit within range.</li>
 * </ul>
 * (FR-006-C, ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param number           lottery number (e.g. 1–35 for a 5/35 game)
 * @param currentGamesOut  GO count as of the most recent (as-of) draw
 * @param zone             "HOT" | "WARM" | "COLD"
 * @param frequencyPercent historical frequency of this exact GO value for this number
 * @param rangeFrequency   transitions to a hit within range-of-10
 * @param drawsAgo         draws since GO value last produced a hit in range
 */
public record NumberFrequencyViewModel(
        int    number,
        int    currentGamesOut,
        String zone,
        double frequencyPercent,
        int    rangeFrequency,
        int    drawsAgo
) {}
