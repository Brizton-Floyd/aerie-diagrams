package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;
import java.util.Map;

/**
 * View model representing position-specific analysis data for a single draw position (FR-016-C).
 *
 * <p>Projected from an entry in the {@code Map<String, PositionAnalysis>} map on
 * {@code RangeAnalysisResponse} by
 * {@link com.floyd.lottoptions.bff.assembler.RangeAnalysisAssembler}.
 *
 * <p><strong>Note on {@code position}:</strong> synthesized from the
 * {@code Map<String, PositionAnalysis>} key in the Core's {@code RangeAnalysisResponse} - this
 * field is NOT present as a named field on the Core value object {@code PositionAnalysis}.
 * The assembler injects the map key as this component so the Angular component receives
 * self-contained objects without needing to correlate parallel arrays.</p>
 *
 * <p>The field {@code currentPositionStreak} from the Core's {@code PositionAnalysis} class
 * is intentionally omitted from this ViewModel because the Angular range-analysis screen
 * does not render it. Add it to a future ViewModel revision if required.</p>
 *
 * @param position          draw position label synthesized from the
 *                          {@code Map<String, PositionAnalysis>} key (not present as a field in
 *                          the Core value object)
 * @param mostLikelyRanges  range labels most likely to contain the number at this position,
 *                          ordered by descending frequency
 * @param leastLikelyRanges range labels least likely to contain the number at this position
 * @param rangeFrequencies  map of range label to observed hit frequency (proportion) at this position
 * @param averageValue      average numeric value drawn at this position across analyzed draws
 * @param standardDeviation standard deviation of numbers drawn at this position
 * @param lastDrawnNumber   most recent number drawn at this position ({@code null} if unavailable)
 */
public record PositionAnalysisViewModel(
        String               position,
        List<String>         mostLikelyRanges,
        List<String>         leastLikelyRanges,
        Map<String, Double>  rangeFrequencies,
        double               averageValue,
        double               standardDeviation,
        Integer              lastDrawnNumber
) {}
