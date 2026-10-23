package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Pattern Analysis panel view model - the proprietary "Pattern String" analysis.
 *
 * <p>Contains the current draw's pattern, the Top-5 predicted patterns for the
 * next draw (similarity-ranked), and the full historical pattern list sorted by
 * frequency descending. Mirrors the three display sections in
 * {@code displayPatternAnalysis} (DashBoardController.java:2033–2147).
 * Computed server-side from the last 500 draws (FR-006-C, ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param currentPattern the pattern derived from the most recent draw
 * @param topPredicted   Top-5 predicted patterns for the next draw, ranked
 * @param allPatterns    all patterns sorted by frequency descending
 */
public record PatternAnalysisViewModel(
        PatternEntryViewModel        currentPattern,
        List<PatternEntryViewModel>  topPredicted,
        List<PatternEntryViewModel>  allPatterns
) {}
