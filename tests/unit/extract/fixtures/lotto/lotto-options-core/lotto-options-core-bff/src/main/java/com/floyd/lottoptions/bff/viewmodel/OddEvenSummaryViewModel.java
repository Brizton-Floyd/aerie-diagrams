package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Wraps the sorted list of odd/even pattern summary entries for the dashboard screen
 * (Story 2, FR-006).
 *
 * <p>Projected from {@code DashboardResponse.oddEvenPatterns} (a {@code Map<String,
 * PatternAnalysisResult>}) by {@code DashboardViewModelAssembler}. The map is
 * converted to a {@link List} sorted by pattern key so that the Angular template
 * can iterate with {@code @for} without needing {@code keyvalue} pipe gymnastics,
 * and so the JSON serialization order is stable (ADR-0003).</p>
 *
 * <p>Wraps a list rather than extending it so that the OpenAPI schema generator
 * (springdoc) emits a named {@code OddEvenSummaryViewModel} object in
 * {@code components/schemas}, which the frontend type-gen pipeline requires
 * (FR-006-G).</p>
 *
 * <p>Immutable by definition as a Java Record (Effective Java Item 17). No setters,
 * no Lombok required.</p>
 *
 * @param patterns sorted list of odd/even pattern entries; never {@code null} -
 *                 an empty list is returned when the source map is null or empty
 *                 (Effective Java Item 54)
 */
public record OddEvenSummaryViewModel(
        List<PatternSummaryEntryViewModel> patterns
) {
}
