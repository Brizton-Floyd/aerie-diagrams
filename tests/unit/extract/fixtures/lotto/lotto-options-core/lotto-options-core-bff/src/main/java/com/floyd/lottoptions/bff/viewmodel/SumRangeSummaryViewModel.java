package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Top-level response shape for the Sum-Range distribution panel (FR-011-A).
 *
 * <p>Wraps the list of sum-range buckets, each represented by the existing
 * five-column {@link PatternSummaryEntryViewModel}.  Follows the same envelope
 * precedent as {@link OddEvenSummaryViewModel} and {@link HighLowSummaryViewModel}
 * so SpringDoc emits a named OpenAPI schema component automatically.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param patterns the list of sum-range buckets, sorted by probability descending;
 *                 never {@code null} - {@code List.of()} when no history is available
 *                 (Effective Java Item 54)
 */
public record SumRangeSummaryViewModel(
        List<PatternSummaryEntryViewModel> patterns
) {}
