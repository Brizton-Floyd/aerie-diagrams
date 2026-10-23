package com.floyd.lottoptions.core.contract.dashboard;

import java.util.List;
import java.util.Map;

/**
 * Response body of {@code GET /api/v1/analysis/{state}/{game}/dashboard}: the game's games out
 * after every draw and its odd/even and high/low patterns, over the full draw history.
 *
 * @param drawResultPatterns      the games out after each draw, oldest draw first
 * @param oddEvenPatterns         the recent odd/even patterns by name, the most expected first
 * @param highLowPatterns         the recent high/low patterns by name, the most expected first
 * @param historyBeginAndEndDates the oldest and the latest draw's dates, as {@code MMMM d, yyyy}
 * @param gameFormat              the pick count and the field's largest number, as
 *                                {@code pickCount/max} (for example {@code 5/35})
 * @param totalDraws              the draws in the history
 */
public record DashboardResponse(List<DrawResultPattern> drawResultPatterns,
                                Map<String, PatternAnalysisResult> oddEvenPatterns,
                                Map<String, PatternAnalysisResult> highLowPatterns,
                                List<String> historyBeginAndEndDates,
                                String gameFormat,
                                int totalDraws) {}
