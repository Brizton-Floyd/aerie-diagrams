package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;
import java.util.Map;

/**
 * View model representing the range-analysis results for a single historical draw (FR-016-C).
 *
 * <p>Projected from {@code RangeAnalysisResponse.DrawResult} by
 * {@link com.floyd.lottoptions.bff.assembler.RangeAnalysisAssembler}. All field values
 * are relayed directly from the Core; {@code totalHits} is NOT recomputed in the BFF
 * (pure relay - the Core's value is authoritative).</p>
 *
 * @param drawDate        date of the draw in {@code YYYY-MM-DD} format
 * @param rangeHits       map of range label to hit count for this draw
 *                        (e.g. {@code {"1-5": 2, "6-10": 0}})
 * @param totalHits       total number of hits across all ranges for this draw; relayed from
 *                        {@code DrawResult.totalHits} - NEVER recomputed in the assembler
 * @param analyzedNumbers the numbers that were drawn for this draw (actual, delta, or
 *                        sorted-delta depending on the requested {@code analysisType})
 */
public record DrawResultViewModel(
        String               drawDate,
        Map<String, Integer> rangeHits,
        int                  totalHits,
        List<Integer>        analyzedNumbers
) {}
