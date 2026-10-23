package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Wraps the sorted list of high/low pattern summary entries for the dashboard screen
 * (Story 2, FR-006).
 *
 * <p>Projected from {@code DashboardResponse.highLowPatterns} (a {@code Map<String,
 * PatternAnalysisResult>}) by {@code DashboardViewModelAssembler}. The map is
 * converted to a {@link List} sorted by pattern key for stable serialization order
 * and simplified Angular template iteration (ADR-0003).</p>
 *
 * <p>Wraps a list rather than extending it so that springdoc emits a named
 * {@code HighLowSummaryViewModel} object in {@code components/schemas}, enabling
 * the frontend type-gen pipeline to produce a typed TypeScript interface
 * (FR-006-G).</p>
 *
 * <p>Immutable by definition as a Java Record (Effective Java Item 17). No setters,
 * no Lombok required.</p>
 *
 * @param patterns sorted list of high/low pattern entries; never {@code null} -
 *                 an empty list is returned when the source map is null or empty
 *                 (Effective Java Item 54)
 */
public record HighLowSummaryViewModel(
        List<PatternSummaryEntryViewModel> patterns
) {
}
