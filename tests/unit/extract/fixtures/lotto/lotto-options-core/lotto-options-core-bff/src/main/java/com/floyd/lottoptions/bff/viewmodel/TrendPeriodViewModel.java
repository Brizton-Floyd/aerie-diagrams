package com.floyd.lottoptions.bff.viewmodel;

/**
 * One OHLC period (5-draw bucket) in the Position Trend chart.
 *
 * <p>Mirrors {@code PositionTrendPoint} from the desktop's
 * {@code PositionTrendService.java:116–130} and the chart's
 * {@code TrendPeriodViewModel} series (TradingStyleChart.java:188–292).
 * MA values are {@code null} when insufficient history is available
 * (FR-006-C, ADR-0003).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param label        "T1", "T2", … for x-axis
 * @param open         first GO value in the 5-draw period
 * @param high         max GO value in the period
 * @param low          min GO value in the period
 * @param close        last GO value in the period
 * @param hitCount     draws in this period where position number had GO==0
 * @param hitFrequency hitCount / periodSize
 * @param trend        "BULLISH" | "BEARISH" | "SIDEWAYS"
 * @param ma5          MA(5) over close values; {@code null} if fewer than 5 periods
 * @param ma10         MA(10) over close values; {@code null} if fewer than 10 periods
 * @param ma20         MA(20) over close values; {@code null} if fewer than 20 periods
 */
public record TrendPeriodViewModel(
        String label,
        int    open,
        int    high,
        int    low,
        int    close,
        int    hitCount,
        double hitFrequency,
        String trend,
        Double ma5,
        Double ma10,
        Double ma20
) {}
