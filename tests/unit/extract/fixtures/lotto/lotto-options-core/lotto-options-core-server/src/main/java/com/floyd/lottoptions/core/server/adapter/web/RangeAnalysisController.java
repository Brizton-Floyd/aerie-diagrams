package com.floyd.lottoptions.core.server.adapter.web;

import com.floyd.lottoptions.core.application.range.AnalyzeRanges;
import com.floyd.lottoptions.core.application.range.RangeAnalysis;
import com.floyd.lottoptions.core.application.range.RangeQuery;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisRequest;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse.DrawResult;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse.GameConfiguration;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse.PositionAnalysis;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse.RangePerformanceMetrics;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.core.domain.range.AnalysisType;
import com.floyd.lottoptions.core.domain.range.AnalyzedDraw;
import com.floyd.lottoptions.core.domain.range.PositionMetrics;
import com.floyd.lottoptions.core.domain.range.Range;
import com.floyd.lottoptions.core.domain.range.RangeMetrics;
import com.floyd.lottoptions.core.domain.range.Streak;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Core API endpoint for range analysis: how a game's draws fall into ranges of numbers, latest
 * draw first, with each range's and each position's performance when asked for.
 *
 * <p>The analysis runs on the bounded-elastic scheduler, because reading the draw history
 * blocks. A missing game answers 404 and a down or failing results service 503, through
 * {@code com.floyd.lottoptions.controller.LiveApiExceptionHandler}.</p>
 */
@RestController
@RequestMapping("/api/v1/analysis")
public class RangeAnalysisController {

    private static final Logger log = LoggerFactory.getLogger(RangeAnalysisController.class);

    /** The draws' dates on the wire, for example {@code 2026-10-01}. */
    private static final DateTimeFormatter DRAW_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final AnalyzeRanges analyzeRanges;

    /**
     * @param analyzeRanges the use case that analyzes a game's ranges
     */
    public RangeAnalysisController(AnalyzeRanges analyzeRanges) {
        this.analyzeRanges = analyzeRanges;
    }

    /**
     * Analyzes a game's ranges.
     *
     * @param request the game, the range size, the analysis type and the positions to count
     * @return 200 with the analysis; 400 without a body when the request is invalid, the results
     *         service answered without the game, or the game has no complete draw
     */
    @PostMapping("/range-analysis")
    public Mono<ResponseEntity<RangeAnalysisResponse>> analyzeRanges(@RequestBody RangeAnalysisRequest request) {
        log.info("Received range analysis request for {} {} with range size {}",
                request.lotteryState(), request.lotteryGame(), request.rangeSize());
        if (!request.isValid()) {
            log.warn("Invalid range analysis request: {}", request);
            return Mono.just(ResponseEntity.badRequest().build());
        }
        log.info("Starting range analysis: {}", request.analysisDescription());

        return Mono.fromCallable(() -> analyzeRanges.analyze(toQuery(request))
                        .map(analysis -> toResponse(request, analysis))
                        .orElse(null))
                .subscribeOn(Schedulers.boundedElastic())
                .map(response -> {
                    if (response.isValid()) {
                        log.info("Range analysis completed successfully: {}", response.analysisSummary());
                        return ResponseEntity.ok(response);
                    }
                    log.warn("Range analysis produced invalid response");
                    return ResponseEntity.badRequest().<RangeAnalysisResponse>build();
                })
                .defaultIfEmpty(ResponseEntity.badRequest().build());
    }

    private static RangeQuery toQuery(RangeAnalysisRequest request) {
        return new RangeQuery(
                new GameId(request.lotteryState(), request.lotteryGame()),
                request.rangeSize(),
                Objects.requireNonNullElse(request.drawPositions(), List.of()),
                AnalysisType.valueOf(request.analysisType().name()),
                Objects.requireNonNullElse(request.maxDraws(), 0),
                Boolean.TRUE.equals(request.includePerformanceMetrics()));
    }

    private static RangeAnalysisResponse toResponse(RangeAnalysisRequest request, RangeAnalysis analysis) {
        GameConfiguration configuration = new GameConfiguration(
                request.lotteryState(),
                request.lotteryGame(),
                "1-" + analysis.largestNumber(),
                analysis.positionCount(),
                request.analysisType().name(),
                request.rangeSize(),
                request.drawPositions());
        List<DrawResult> draws = analysis.draws().stream().map(RangeAnalysisController::toDrawResult).toList();
        return new RangeAnalysisResponse(
                configuration,
                analysis.ranges().stream().map(Range::label).toList(),
                draws,
                draws.size(),
                analysis.performance().map(performance -> byLabel(performance.byRange())).orElse(null),
                analysis.performance().map(performance -> byPosition(performance.byPosition())).orElse(null));
    }

    private static DrawResult toDrawResult(AnalyzedDraw draw) {
        Map<String, Integer> rangeHits = new LinkedHashMap<>();
        draw.hits().forEach((range, hits) -> rangeHits.put(range.label(), hits));
        return new DrawResult(date(draw.date()), rangeHits, draw.numbers().size(), draw.numbers());
    }

    private static Map<String, RangePerformanceMetrics> byLabel(Map<Range, RangeMetrics> byRange) {
        Map<String, RangePerformanceMetrics> byLabel = new LinkedHashMap<>();
        byRange.forEach((range, metrics) -> byLabel.put(range.label(), new RangePerformanceMetrics(
                metrics.totalHits(),
                metrics.hitFrequency(),
                metrics.averageGap(),
                streak(metrics.streak()),
                metrics.lastHit().map(RangeAnalysisController::date).orElse(null),
                RangePerformanceMetrics.RangeStatus.valueOf(metrics.status().name()),
                metrics.daysSinceLastHit(),
                metrics.expectedProbability(),
                metrics.gapVariance())));
        return byLabel;
    }

    private static Map<String, PositionAnalysis> byPosition(List<PositionMetrics> byPosition) {
        Map<String, PositionAnalysis> analyses = new LinkedHashMap<>();
        for (PositionMetrics position : byPosition) {
            Map<String, Double> frequencies = new LinkedHashMap<>();
            position.frequencies().forEach((range, frequency) -> frequencies.put(range.label(), frequency));
            analyses.put("position" + position.position(), new PositionAnalysis(
                    labels(position.mostLikely()),
                    labels(position.leastLikely()),
                    frequencies,
                    position.average(),
                    position.standardDeviation(),
                    position.lastDrawn().isPresent() ? position.lastDrawn().getAsInt() : null,
                    position.lastDrawnRange().map(range -> range.label() + "_RECENT").orElse("N/A")));
        }
        return analyses;
    }

    private static List<String> labels(List<Range> ranges) {
        return ranges.stream().map(Range::label).toList();
    }

    /** A streak on the wire: {@code HOT_3} for three draws in a row that hit, {@code COLD_5} for misses. */
    private static String streak(Streak streak) {
        return (streak.hot() ? "HOT_" : "COLD_") + streak.draws();
    }

    private static String date(LocalDate date) {
        return DRAW_DATE.format(date);
    }
}
