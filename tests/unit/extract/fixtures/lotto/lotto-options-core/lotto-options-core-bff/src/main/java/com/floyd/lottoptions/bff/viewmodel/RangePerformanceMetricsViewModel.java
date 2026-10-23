package com.floyd.lottoptions.bff.viewmodel;

/**
 * View model representing performance statistics for a single range bucket (FR-016-C).
 *
 * <p>Projected from an entry in the {@code Map<String, RangePerformanceMetrics>} map
 * on {@code RangeAnalysisResponse} by
 * {@link com.floyd.lottoptions.bff.assembler.RangeAnalysisAssembler}.
 *
 * <p><strong>Note on {@code range}:</strong> synthesized from the {@code Map<String,
 * RangePerformanceMetrics>} key in the Core's {@code RangeAnalysisResponse} - this field
 * is NOT present as a named field on the Core value object {@code RangePerformanceMetrics}.
 * The assembler injects the map key as this component so the Angular component receives
 * self-contained objects without needing to correlate parallel arrays.</p>
 *
 * <p><strong>Note on {@code status}:</strong> relayed from the Core's
 * {@code RangePerformanceMetrics.RangeStatus} enum via {@code RangeStatus.name()}.
 * Valid values are: {@code "HOT"}, {@code "NORMAL"}, {@code "COLD"}.
 * The values {@code "OVERDUE"} and {@code "HOLD"} are NOT present in the Core model
 * and are therefore not emitted by this BFF (the BFF is a pure relay - no domain logic
 * is added here; a Core model extension FR is required if these values are needed).</p>
 *
 * @param range               range label synthesized from the {@code Map<String, RangePerformanceMetrics>}
 *                            key (not present as a field in the Core value object)
 * @param totalHits           total hit count across all analyzed draws for this range
 * @param hitFrequency        percentage of draws where this range had at least one hit
 * @param avgGapBetweenHits   average number of draws between successive hits
 * @param currentStreak       streak description (e.g. {@code "COLD_5"} = 5 draws without a hit)
 * @param lastHitDraw         date string of the most recent draw in which this range was hit
 * @param status              status of this range relayed from {@code RangeStatus.name()};
 *                            values: {@code "HOT"} | {@code "NORMAL"} | {@code "COLD"}
 * @param daysSinceLastHit    number of days since the range was last hit (drought indicator)
 * @param expectedProbability expected hit probability derived from historical data
 * @param gapVariance         variance in the gap sizes between successive hits
 */
public record RangePerformanceMetricsViewModel(
        String  range,
        int     totalHits,
        double  hitFrequency,
        double  avgGapBetweenHits,
        String  currentStreak,
        String  lastHitDraw,
        String  status,
        int     daysSinceLastHit,
        double  expectedProbability,
        double  gapVariance
) {}
