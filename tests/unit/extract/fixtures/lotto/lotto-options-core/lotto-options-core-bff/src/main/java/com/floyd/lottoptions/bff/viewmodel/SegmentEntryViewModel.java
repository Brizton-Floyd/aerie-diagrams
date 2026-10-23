package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Statistics and recommendation for one 10-number pool segment (FR-011-B).
 *
 * <p>Covers a contiguous range of lottery numbers (e.g. {@code "1–10"}).
 * All hit/accuracy metrics are derived from the full draw history - no random
 * values are introduced (constraint from ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param rangeLabel      human-readable label, e.g. {@code "1–10"}
 * @param numbers         per-number detail for every number in this segment,
 *                        sorted ascending by number
 * @param avgGamesOut     mean current games-out across all numbers in the segment;
 *                        {@code 0.0} when the segment is empty
 * @param actualHits      total count of draws in history where any number in this
 *                        segment was drawn (games-out == 0 in the draw)
 * @param expectedHits    {@code (segmentSize / pool) * pick * totalDraws}; may be
 *                        fractional
 * @param accuracyRatio   {@code actualHits / expectedHits}; {@code 0.0} when
 *                        {@code expectedHits == 0} (division-by-zero guard)
 * @param recommendation  the single recommendation entry for this segment
 */
public record SegmentEntryViewModel(
        String rangeLabel,
        List<SegmentNumberDetailViewModel> numbers,
        double avgGamesOut,
        int actualHits,
        double expectedHits,
        double accuracyRatio,
        SegmentRecommendationViewModel recommendation
) {}
