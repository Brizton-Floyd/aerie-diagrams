package com.floyd.lottoptions.bff.viewmodel;

/**
 * Aggregate technical indicators for the Position Trend chart.
 *
 * <p>Mirrors {@code analyzePositionTrends} indicator outputs
 * (PositionTrendService.java:177–205, FR-006-C, ADR-0003).
 * FR-011-C adds a standard 14-period Wilder RSI derived from the per-position
 * close series.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param trendStrength    directional strength score (0.0–1.0)
 * @param volatility       standard deviation of close values across periods
 * @param avgHitFrequency  average hit frequency across all periods
 * @param rsi14            14-period Wilder RSI of the close series (0–100);
 *                         {@code null} when fewer than 15 data points are available
 */
public record TrendIndicatorsViewModel(
        double trendStrength,
        double volatility,
        double avgHitFrequency,
        Double rsi14
) {}
