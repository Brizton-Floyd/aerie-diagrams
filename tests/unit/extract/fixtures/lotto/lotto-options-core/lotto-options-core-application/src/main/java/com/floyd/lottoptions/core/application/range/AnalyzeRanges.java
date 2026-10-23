package com.floyd.lottoptions.core.application.range;

import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.draw.DrawHistorySource;
import com.floyd.lottoptions.core.domain.draw.DrawHistoryUnavailableException;
import com.floyd.lottoptions.core.domain.draw.UnknownGameException;
import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.range.AnalysisType;
import com.floyd.lottoptions.core.domain.range.AnalyzedDraw;
import com.floyd.lottoptions.core.domain.range.PositionPerformance;
import com.floyd.lottoptions.core.domain.range.RangePerformance;
import com.floyd.lottoptions.core.domain.range.Ranges;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Use case: analyze how a game's draws fall into ranges of numbers.
 *
 * <p>Only complete draws count: those with as many numbers as the game's pick count, or every
 * draw when the pick count is unknown. Of those, the latest {@link RangeQuery#maxDraws()} are
 * analyzed, latest first.</p>
 */
public final class AnalyzeRanges {

    /** The largest number when neither the field nor any draw gives one. */
    private static final int DEFAULT_LARGEST_NUMBER = 69;

    private final DrawHistorySource drawHistorySource;

    /**
     * @param drawHistorySource where draw histories are read from
     */
    public AnalyzeRanges(DrawHistorySource drawHistorySource) {
        this.drawHistorySource = Objects.requireNonNull(drawHistorySource, "drawHistorySource");
    }

    /**
     * Analyzes a game's ranges.
     *
     * @param query what to analyze
     * @return the analysis, or empty when the source answered without the game or the game has
     *         no complete draw
     * @throws UnknownGameException           if the source has no such game in the state
     * @throws DrawHistoryUnavailableException if the source is down or failing
     */
    public Optional<RangeAnalysis> analyze(RangeQuery query) {
        return drawHistorySource.load(query.game()).flatMap(history -> analyze(query, history));
    }

    private static Optional<RangeAnalysis> analyze(RangeQuery query, DrawHistory history) {
        Game game = history.game();
        List<Draw> draws = completeDraws(history);
        if (draws.isEmpty()) {
            return Optional.empty();
        }
        if (query.maxDraws() > 0 && draws.size() > query.maxDraws()) {
            draws = draws.subList(draws.size() - query.maxDraws(), draws.size());
        }
        int positionCount = game.pickCount() > 0 ? game.pickCount() : draws.get(0).numbers().size();

        AnalysisType type = query.analysisType();
        Ranges ranges = new Ranges(query.rangeSize(), type.largestNumber(game.format(), fieldLargest(history)));
        List<Draw> newestFirst = new ArrayList<>(draws);
        Collections.reverse(newestFirst);
        List<List<Integer>> analyzedNewestFirst = new ArrayList<>(draws.size());
        List<AnalyzedDraw> analyzedDraws = new ArrayList<>(draws.size());
        for (Draw draw : newestFirst) {
            List<Integer> analyzed = type.analyze(draw.numbers(), game.format());
            List<Integer> atPositions = atPositions(analyzed, query.positions());
            analyzedNewestFirst.add(analyzed);
            analyzedDraws.add(new AnalyzedDraw(draw.date(), atPositions, ranges.hits(atPositions)));
        }

        Optional<RangeAnalysis.Performance> performance = query.includePerformance()
                ? Optional.of(new RangeAnalysis.Performance(
                        RangePerformance.of(ranges.all(), analyzedDraws),
                        PositionPerformance.of(ranges, analyzedNewestFirst, positionCount)))
                : Optional.empty();
        return Optional.of(new RangeAnalysis(game, ranges.largestNumber(), positionCount, ranges.all(),
                analyzedDraws, performance));
    }

    private static List<Draw> completeDraws(DrawHistory history) {
        int pickCount = history.game().pickCount();
        return history.oldestFirst().stream()
                .filter(draw -> pickCount <= 0 || draw.numbers().size() == pickCount)
                .toList();
    }

    /**
     * The field's largest number; when the source gave none above 0, the largest number any
     * draw holds, or {@value #DEFAULT_LARGEST_NUMBER} without one.
     */
    private static int fieldLargest(DrawHistory history) {
        int fieldMax = history.game().field().max();
        if (fieldMax > 0) {
            return fieldMax;
        }
        return history.oldestFirst().stream()
                .flatMap(draw -> draw.numbers().stream())
                .max(Integer::compareTo)
                .orElse(DEFAULT_LARGEST_NUMBER);
    }

    /** The numbers at the given positions, in the positions' order; all of them for none. */
    private static List<Integer> atPositions(List<Integer> numbers, List<Integer> positions) {
        if (positions.isEmpty()) {
            return numbers;
        }
        List<Integer> selected = new ArrayList<>(positions.size());
        for (int position : positions) {
            if (position >= 1 && position <= numbers.size()) {
                selected.add(numbers.get(position - 1));
            }
        }
        return selected;
    }
}
