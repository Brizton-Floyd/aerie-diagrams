package com.floyd.lottoptions.bff.viewmodel;

/**
 * Represents one pattern entry from the odd/even or high/low pattern summary for
 * the dashboard screen (Story 2, FR-006).
 *
 * <p>Projected from one {@code Map.Entry<String, PatternAnalysisResult>} in
 * {@code DashboardResponse.oddEvenPatterns} or {@code .highLowPatterns} by
 * {@code DashboardViewModelAssembler}. Maps are converted to lists sorted by
 * pattern key for stable JSON serialization and easy Angular iteration
 * (ADR-0003).</p>
 *
 * <p>Immutable by definition as a Java Record (Effective Java Item 17). No setters,
 * no Lombok required.</p>
 *
 * @param pattern                 the pattern label (e.g. {@code "3-odd-2-even"})
 * @param frequency               how many times this pattern has appeared in history
 * @param probability             historical probability as a decimal (0.0–1.0)
 * @param estimatedHitFrequency   estimated number of draws between appearances
 * @param gamesSinceLastAppearance draws since this pattern last occurred
 */
public record PatternSummaryEntryViewModel(
        String pattern,
        int frequency,
        double probability,
        double estimatedHitFrequency,
        int gamesSinceLastAppearance
) {
}
