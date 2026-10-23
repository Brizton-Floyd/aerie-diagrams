package com.floyd.lottoptions.bff.viewmodel;

/**
 * One Pattern String entry in the Pattern Analysis panel.
 *
 * <p>Used for currentPattern, each top-5 prediction, and each entry in the
 * full pattern list (DashBoardController.java:2048–2146, FR-006-C, ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param patternString the Pattern String, e.g. "3-1-4-2-1"
 * @param frequency     how many times this pattern has appeared in history
 * @param drawsAgo      draws since this pattern last appeared (0 = current draw)
 */
public record PatternEntryViewModel(
        String patternString,
        int    frequency,
        int    drawsAgo
) {}
