package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Top-level response shape for the Segments heat-map panel (FR-011-B).
 *
 * <p>The pool is divided into segments of 10 (ceiling division), and each
 * segment's statistics are computed from the full draw history.  All values
 * derive from real {@code DrawResultPattern} data - no random generation
 * (ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param segments the list of segment entries in ascending range order;
 *                 never {@code null} - {@code List.of()} when no history is
 *                 available (Effective Java Item 54)
 */
public record SegmentsSummaryViewModel(
        List<SegmentEntryViewModel> segments
) {}
