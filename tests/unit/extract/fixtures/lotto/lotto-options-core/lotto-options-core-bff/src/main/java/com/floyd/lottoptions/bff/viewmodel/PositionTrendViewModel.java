package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Top-level response for {@code GET /ui/dashboard/{state}/{game}/position-trend}.
 *
 * <p>Pre-bucketed OHLC periods + moving averages + indicators + analysis for the
 * Trading Chart component (TradingStyleChart.java). Mirrors the full output of
 * {@code PositionTrendService.analyzePositionTrends} (PositionTrendService.java:20–48)
 * without reproducing the desktop's synthetic per-segment frequencies (FR-006-C,
 * ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param position   1-based position selected (1 = first ball drawn)
 * @param range      "30" | "60" | "90" | "all"
 * @param points     OHLC period buckets, oldest-first
 * @param indicators aggregate technical indicators
 * @param analysis   position-level trend analysis
 */
public record PositionTrendViewModel(
        int                          position,
        String                       range,
        List<TrendPeriodViewModel>   points,
        TrendIndicatorsViewModel     indicators,
        TrendAnalysisViewModel       analysis
) {}
