package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;
import java.util.Optional;

/**
 * Top-level response for {@code GET /ui/dashboard/{state}/{game}}.
 *
 * <p>Aggregates every pre-computed panel that does NOT require paging: frequency
 * rollups, pattern analysis, probability panes, metadata scalars, the latest
 * draw result (FR-008-J), and the new analytics panels (FR-011). The matrix and
 * position-trend are fetched via separate paged endpoints to keep the initial
 * payload small (ADR-0003, FR-006-C, Story 2).</p>
 *
 * <p>Design note (Effective Java Item 2): this record has 16 components which
 * exceeds the 4-parameter threshold for a Builder. However, Records are the
 * established BFF view-model standard (ADR-0003); the canonical constructor is
 * the only entry point and Records are inherently immutable. The 7-point audit
 * (FR-006 Section 1.3, FR-008 Section 1.2, FR-011 Section 1.3) documents this
 * decision explicitly. The 15th component {@code sumRangeSummary} adds the
 * sum-range distribution panel (FR-011-A) and the 16th component
 * {@code segmentsSummary} adds the segments heat-map panel (FR-011-B).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param state              lottery state code (e.g. "TX")
 * @param game               lottery game name (e.g. "Cash Five")
 * @param gameFormat         Core API game format string (e.g. "5/35")
 * @param totalDraws         total number of draws in history
 * @param fieldMin           minimum number in the field (for column headers)
 * @param fieldMax           maximum number in the field
 * @param gameNumberCount    count of numbers drawn per draw (for legend swatches)
 * @param historyRange       earliest and latest draw date strings
 * @param frequencyRollups   one {@link NumberFrequencyViewModel} per number in field
 * @param rangeRollups       one {@link RangeRollupViewModel} per range-of-10
 * @param patternAnalysis    current pattern + top-5 predictions + all patterns
 * @param oddEvenSummary     odd/even probability pane data
 * @param highLowSummary     high/low probability pane data
 * @param latestDraw         the most recent draw's date + ordered drawn balls (FR-008-J);
 *                           {@code Optional.empty()} if no draw data is available
 * @param sumRangeSummary    sum-range distribution panel (FR-011-A); never {@code null}
 * @param segmentsSummary    segments heat-map panel (FR-011-B); never {@code null}
 */
public record DashboardAggregatesViewModel(
        String                          state,
        String                          game,
        String                          gameFormat,
        int                             totalDraws,
        int                             fieldMin,
        int                             fieldMax,
        int                             gameNumberCount,
        HistoryRangeViewModel           historyRange,
        List<NumberFrequencyViewModel>  frequencyRollups,
        List<RangeRollupViewModel>      rangeRollups,
        PatternAnalysisViewModel        patternAnalysis,
        OddEvenSummaryViewModel         oddEvenSummary,
        HighLowSummaryViewModel         highLowSummary,
        Optional<LatestDrawViewModel>   latestDraw,
        SumRangeSummaryViewModel        sumRangeSummary,
        SegmentsSummaryViewModel        segmentsSummary
) {}
