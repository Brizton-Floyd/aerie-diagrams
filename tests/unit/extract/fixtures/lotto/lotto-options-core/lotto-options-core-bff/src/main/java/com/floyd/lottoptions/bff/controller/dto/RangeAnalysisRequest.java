package com.floyd.lottoptions.bff.controller.dto;

import java.util.List;

/**
 * BFF-side request DTO for the range-analysis relay endpoint (FR-016-B).
 *
 * <p>This record mirrors {@code com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest} field-for-field.
 * It is declared in the BFF controller layer so that the controller never imports Core model
 * classes directly - module isolation is maintained; bridging to the Core enum is done in the
 * assembler/service layer (see {@link com.floyd.lottoptions.bff.service.RangeAnalysisService}).
 * </p>
 *
 * <p>All components are immutable (Java Record, Effective Java Item 17). No Lombok.</p>
 *
 * <p>Consumed by {@code POST /ui/range-analysis} (FR-016-F) and forwarded to
 * the Core API's {@code POST /api/v1/analysis/range-analysis} endpoint.</p>
 *
 * @param lotteryState             the lottery state code (e.g. {@code "FL"}, {@code "CA"})
 * @param lotteryGame              the lottery game name (e.g. {@code "Cash4Life"})
 * @param rangeSize                size of each number range group (must be greater than 0;
 *                                 e.g. 5 creates ranges 1–5, 6–10, …)
 * @param analysisType             the type of analysis to perform; must not be {@code null}
 * @param maxDraws                 maximum number of historical draws to include; {@code null} or
 *                                 {@code 0} means all available draws - this value is relayed to
 *                                 the Core unchanged and must NEVER be hardcoded or defaulted
 *                                 in this layer
 * @param includePerformanceMetrics when {@code true}, the Core calculates hot/cold indicators,
 *                                 streaks, and gap analysis; when {@code false} or {@code null},
 *                                 the performance-metrics section is omitted from the response
 * @param drawPositions            specific 1-based draw positions to analyze; {@code null} or
 *                                 empty means all positions
 */
public record RangeAnalysisRequest(
        String          lotteryState,
        String          lotteryGame,
        int             rangeSize,
        AnalysisType    analysisType,
        Integer         maxDraws,
        Boolean         includePerformanceMetrics,
        List<Integer>   drawPositions
) {

    /**
     * Supported analysis modes for range analysis.
     *
     * <p>Redeclared in the BFF DTO for module isolation. The assembler bridges this enum
     * to {@code com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest.AnalysisType} by name via
     * {@link Enum#valueOf(Class, String)}.</p>
     *
     * <ul>
     *   <li>{@link #ACTUAL} - use the actual drawn numbers as-is</li>
     *   <li>{@link #DELTA} - use delta calculations between consecutive numbers</li>
     *   <li>{@link #DELTA_SORTED} - use delta calculations on sorted numbers</li>
     * </ul>
     */
    public enum AnalysisType {
        /** Use the actual drawn numbers as-is. */
        ACTUAL,
        /** Use delta calculations between consecutive numbers. */
        DELTA,
        /** Use delta calculations on sorted numbers. */
        DELTA_SORTED
    }
}
