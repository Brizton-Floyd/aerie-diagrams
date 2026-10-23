package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * View model representing the lottery game configuration for a range-analysis response (FR-016-C).
 *
 * <p>Projected from {@code RangeAnalysisResponse.GameConfiguration} by
 * {@link com.floyd.lottoptions.bff.assembler.RangeAnalysisAssembler}. All fields are
 * relayed directly from the Core API; no values are computed in the BFF layer.</p>
 *
 * @param state             lottery state code (e.g. {@code "FL"}, {@code "CA"})
 * @param game              lottery game name (e.g. {@code "Cash4Life"}, {@code "Powerball"})
 * @param numberRange       the full number range of the game (e.g. {@code "1-60"}, {@code "1-69"})
 * @param totalNumbers      number of balls drawn per game
 * @param analysisType      analysis type used (relayed as a string from the Core)
 * @param rangeSize         range group size used (e.g. {@code 5} for 1–5, 6–10, …)
 * @param analyzedPositions specific draw positions that were analyzed; {@code null} or empty
 *                          means all positions were analyzed - relayed from the Core and
 *                          returned as {@link List#of()} when null (Effective Java Item 54)
 */
public record GameConfigurationViewModel(
        String          state,
        String          game,
        String          numberRange,
        int             totalNumbers,
        String          analysisType,
        int             rangeSize,
        List<Integer>   analyzedPositions
) {}
