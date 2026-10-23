package com.floyd.lottoptions.core.contract.range;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import java.util.List;

/**
 * Request body of {@code POST /api/v1/analysis/range-analysis}: which draws of a game to bucket
 * into ranges, and how.
 *
 * <p>The body also carries two read-only properties, {@code valid} and
 * {@code analysisDescription}; they are written and ignored on reading.</p>
 *
 * @param lotteryState              the state's name (for example {@code Texas})
 * @param lotteryGame               the game's full name (for example {@code Cash Five})
 * @param rangeSize                 the numbers per range: 10 gives 1-10, 11-20 and so on; greater
 *                                  than 0
 * @param drawPositions             the positions whose numbers each draw's range hits count, from
 *                                  1; {@code null} or empty for every position
 * @param analysisType              which numbers of each draw are bucketed
 * @param maxDraws                  how many of the latest draws to analyze; {@code null} or
 *                                  {@code 0} for all
 * @param includePerformanceMetrics whether to add the per-range and per-position performance
 */
@JsonPropertyOrder({"lotteryState", "lotteryGame", "rangeSize", "drawPositions", "analysisType", "maxDraws",
        "includePerformanceMetrics", "valid", "analysisDescription"})
@JsonIgnoreProperties(value = {"valid", "analysisDescription"}, allowGetters = true)
public record RangeAnalysisRequest(String lotteryState, String lotteryGame, int rangeSize,
                                   List<Integer> drawPositions, AnalysisType analysisType, Integer maxDraws,
                                   Boolean includePerformanceMetrics) {

    /**
     * Which numbers of each draw are bucketed.
     */
    public enum AnalysisType {

        /** The numbers drawn; a digit game's digits encoded by position into 0-39. */
        ACTUAL,

        /** The first number, then the distance from each number to the one before it. */
        DELTA,

        /** The {@link #DELTA} values, smallest first. */
        DELTA_SORTED
    }

    /**
     * @return whether the request names a state and a game, a range size above 0 and an
     *         analysis type, and no {@code maxDraws} or draw position below its minimum
     */
    @JsonProperty("valid")
    public boolean isValid() {
        return lotteryState != null && !lotteryState.trim().isEmpty()
                && lotteryGame != null && !lotteryGame.trim().isEmpty()
                && rangeSize > 0
                && analysisType != null
                && (maxDraws == null || maxDraws >= 0)
                && (drawPositions == null || drawPositions.stream().allMatch(position -> position > 0));
    }

    /**
     * @return the request in words, for example {@code Range Analysis: Texas Cash Five with range
     *         size 10 using ACTUAL numbers for all positions with performance metrics}
     */
    @JsonProperty("analysisDescription")
    public String analysisDescription() {
        StringBuilder description = new StringBuilder();
        description.append("Range Analysis: ")
                .append(lotteryState).append(' ').append(lotteryGame)
                .append(" with range size ").append(rangeSize)
                .append(" using ").append(analysisType).append(" numbers");
        if (drawPositions != null && !drawPositions.isEmpty()) {
            description.append(" for positions ").append(drawPositions);
        } else {
            description.append(" for all positions");
        }
        if (maxDraws != null && maxDraws > 0) {
            description.append(" (max ").append(maxDraws).append(" draws)");
        }
        if (Boolean.TRUE.equals(includePerformanceMetrics)) {
            description.append(" with performance metrics");
        }
        return description.toString();
    }
}
