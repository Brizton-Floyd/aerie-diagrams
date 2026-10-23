package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Position-level trend analysis: hot/cold numbers at this position, primary trend,
 * confidence, and textual insights.
 *
 * <p>Mirrors {@code analyzePosition} (PositionTrendService.java:207–265,
 * FR-006-C, ADR-0003). All collection fields return empty lists - never
 * {@code null} (Effective Java Item 54).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param primaryTrend "BULLISH" | "BEARISH" | "SIDEWAYS" for this position overall
 * @param confidence   confidence score 0.0–1.0
 * @param hotNumbers   top-5 most frequent numbers at this position (by hit count)
 * @param coldNumbers  top-5 least frequent numbers at this position
 * @param insights     textual insight strings for the indicator panel
 */
public record TrendAnalysisViewModel(
        String          primaryTrend,
        double          confidence,
        List<Integer>   hotNumbers,
        List<Integer>   coldNumbers,
        List<String>    insights
) {}
