package com.floyd.lottoptions.bff.viewmodel;

/**
 * Date range of the available draw history, used in the Probability Estimation
 * panel sub-header ({@code <startDate> to <endDate> (N Draws)}).
 *
 * <p>Projected from {@code DashboardResponse.historyBeginAndEndDates[0]} and
 * {@code [1]} by {@link com.floyd.lottoptions.bff.assembler.OddEvenHighLowAssembler}
 * via the service. Strings are preserved verbatim; no date parsing in the BFF
 * (ADR-0003, FR-006-C).</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param earliestDraw oldest draw date string from Core API
 * @param latestDraw   most recent draw date string from Core API
 */
public record HistoryRangeViewModel(
        String earliestDraw,
        String latestDraw
) {
}
