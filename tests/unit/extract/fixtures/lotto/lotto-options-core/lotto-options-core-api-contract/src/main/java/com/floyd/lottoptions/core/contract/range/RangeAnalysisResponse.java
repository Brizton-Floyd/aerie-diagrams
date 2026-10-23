package com.floyd.lottoptions.core.contract.range;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import java.util.List;
import java.util.Map;

/**
 * Response body of {@code POST /api/v1/analysis/range-analysis}: each analyzed draw's numbers
 * bucketed into ranges, latest draw first, with the ranges' and positions' performance when
 * asked for.
 *
 * <p>The body ends with three read-only properties, {@code totalRanges}, {@code analysisSummary}
 * and {@code valid}; they are written and ignored on reading.</p>
 *
 * @param gameConfiguration  the game and the analysis's settings
 * @param rangeHeaders       the ranges' labels, smallest range first, for example {@code 1-10}
 * @param drawResults        the analyzed draws, latest first
 * @param totalDrawsAnalyzed the analyzed draws
 * @param performanceMetrics every range's performance by label, smallest range first;
 *                           {@code null} unless asked for
 * @param positionAnalysis   every position's performance, keyed {@code position1},
 *                           {@code position2} and so on; {@code null} unless asked for
 */
@JsonPropertyOrder({"gameConfiguration", "rangeHeaders", "drawResults", "totalDrawsAnalyzed", "performanceMetrics",
        "positionAnalysis", "totalRanges", "analysisSummary", "valid"})
@JsonIgnoreProperties(value = {"totalRanges", "analysisSummary", "valid"}, allowGetters = true)
public record RangeAnalysisResponse(GameConfiguration gameConfiguration, List<String> rangeHeaders,
                                    List<DrawResult> drawResults, int totalDrawsAnalyzed,
                                    Map<String, RangePerformanceMetrics> performanceMetrics,
                                    Map<String, PositionAnalysis> positionAnalysis) {

    /**
     * @return the number of ranges
     */
    @JsonProperty("totalRanges")
    public int totalRanges() {
        return rangeHeaders != null ? rangeHeaders.size() : 0;
    }

    /**
     * @return the analysis in words, for example {@code Texas Cash Five - Range Size: 10,
     *         Analysis: ACTUAL, Draws: 8000}
     */
    @JsonProperty("analysisSummary")
    public String analysisSummary() {
        if (gameConfiguration == null) {
            return "Range Analysis Results";
        }
        StringBuilder summary = new StringBuilder();
        summary.append(gameConfiguration.state())
                .append(' ').append(gameConfiguration.game())
                .append(" - Range Size: ").append(gameConfiguration.rangeSize())
                .append(", Analysis: ").append(gameConfiguration.analysisType())
                .append(", Draws: ").append(totalDrawsAnalyzed);
        if (gameConfiguration.analyzedPositions() != null && !gameConfiguration.analyzedPositions().isEmpty()) {
            summary.append(", Positions: ").append(gameConfiguration.analyzedPositions());
        }
        return summary.toString();
    }

    /**
     * @return whether the configuration, the headers and the draws are present and every draw
     *         counts hits for every range
     */
    @JsonProperty("valid")
    public boolean isValid() {
        if (gameConfiguration == null || rangeHeaders == null || drawResults == null) {
            return false;
        }
        return drawResults.stream().allMatch(
                draw -> draw.rangeHits() != null && draw.rangeHits().keySet().containsAll(rangeHeaders));
    }

    /**
     * The game and the analysis's settings.
     *
     * @param state             the state's name
     * @param game              the game's full name
     * @param numberRange       the numbers the ranges cover, as {@code 1-max} (for example
     *                          {@code 1-35}, or {@code 1-39} for a digit game's actual numbers)
     * @param totalNumbers      the numbers per draw
     * @param analysisType      the analysis type's name, for example {@code ACTUAL}
     * @param rangeSize         the numbers per range
     * @param analyzedPositions the request's draw positions, as sent
     */
    public record GameConfiguration(String state, String game, String numberRange, int totalNumbers,
                                    String analysisType, int rangeSize, List<Integer> analyzedPositions) {}

    /**
     * One analyzed draw.
     *
     * @param drawDate        the draw's date, as {@code yyyy-MM-dd}
     * @param rangeHits       every range's label with the numbers that fell in it, smallest
     *                        range first
     * @param totalHits       the numbers bucketed, in or out of the ranges
     * @param analyzedNumbers the numbers bucketed: actual numbers, deltas or sorted deltas, at
     *                        the requested positions
     */
    public record DrawResult(String drawDate, Map<String, Integer> rangeHits, int totalHits,
                             List<Integer> analyzedNumbers) {}

    /**
     * How one range performed over the analyzed draws.
     *
     * @param totalHits           the numbers that fell in the range
     * @param hitFrequency        the share of draws that hit the range
     * @param avgGapBetweenHits   the average length of the runs of draws that missed it
     * @param currentStreak       the current run of hits or misses, for example {@code HOT_3} or
     *                            {@code COLD_5}
     * @param lastHitDraw         the latest hit's date, as {@code yyyy-MM-dd}; {@code null} when
     *                            no draw hit the range
     * @param status              how often the range hits against a baseline of one draw in five
     * @param daysSinceLastHit    the days from the last hit (or the oldest draw, when none hit)
     *                            to the latest draw
     * @param expectedProbability the expected chance a draw hits the range: its hit frequency
     * @param gapVariance         the population variance of the runs of misses
     */
    public record RangePerformanceMetrics(int totalHits, double hitFrequency, double avgGapBetweenHits,
                                          String currentStreak, String lastHitDraw, RangeStatus status,
                                          int daysSinceLastHit, double expectedProbability, double gapVariance) {

        /**
         * How often a range hits against the baseline.
         */
        public enum RangeStatus {
            HOT,
            NORMAL,
            COLD
        }
    }

    /**
     * How one position's numbers spread over the ranges.
     *
     * @param mostLikelyRanges      up to three ranges the position hit, the most often first
     * @param leastLikelyRanges     up to three other ranges, the least often first
     * @param rangeFrequencies      every range's label with the share of draws whose number at
     *                              the position fell in it
     * @param averageValue          the average number at the position
     * @param standardDeviation     the numbers' population standard deviation
     * @param lastDrawnNumber       the number at the position in the latest draw; {@code null}
     *                              without one
     * @param currentPositionStreak {@code <range>_RECENT} for the latest number's range, or
     *                              {@code N/A}
     */
    public record PositionAnalysis(List<String> mostLikelyRanges, List<String> leastLikelyRanges,
                                   Map<String, Double> rangeFrequencies, double averageValue,
                                   double standardDeviation, Integer lastDrawnNumber,
                                   String currentPositionStreak) {}
}
