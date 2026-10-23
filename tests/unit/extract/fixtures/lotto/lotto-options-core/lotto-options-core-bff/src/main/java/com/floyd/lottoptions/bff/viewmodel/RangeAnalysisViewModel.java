package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Top-level view model for the BFF range-analysis relay endpoint (FR-016-C).
 *
 * <p>Projects the Core API's {@code RangeAnalysisResponse} into a slim, frontend-ready
 * representation. All fields are assembled by
 * {@link com.floyd.lottoptions.bff.assembler.RangeAnalysisAssembler}; no domain logic
 * is performed in this layer.</p>
 *
 * <p>Serialized by Jackson for delivery to the Angular range-analysis screen (FR-017).
 * All five record types in this ViewModel appear in the OpenAPI {@code components/schemas}
 * section (FR-016-H).</p>
 *
 * @param gameConfiguration   lottery game configuration and analysis parameters
 * @param rangeHeaders        ordered list of range label strings (e.g. {@code ["1-5", "6-10"]})
 * @param totalDrawsAnalyzed  total number of historical draws included in the analysis
 * @param drawResults         per-draw analysis results, ordered most-recent first
 * @param performanceMetrics  per-range performance statistics; empty list when not requested
 *                            (never {@code null} - Effective Java Item 54)
 * @param positionAnalysis    per-position analysis results; empty list when not requested
 *                            (never {@code null} - Effective Java Item 54)
 */
public record RangeAnalysisViewModel(
        GameConfigurationViewModel              gameConfiguration,
        List<String>                            rangeHeaders,
        int                                     totalDrawsAnalyzed,
        List<DrawResultViewModel>               drawResults,
        List<RangePerformanceMetricsViewModel>  performanceMetrics,
        List<PositionAnalysisViewModel>         positionAnalysis
) {}
