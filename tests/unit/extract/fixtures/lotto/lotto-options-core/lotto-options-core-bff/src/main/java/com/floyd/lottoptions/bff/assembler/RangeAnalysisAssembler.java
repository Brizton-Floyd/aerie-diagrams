package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.DrawResultViewModel;
import com.floyd.lottoptions.bff.viewmodel.GameConfigurationViewModel;
import com.floyd.lottoptions.bff.viewmodel.PositionAnalysisViewModel;
import com.floyd.lottoptions.bff.viewmodel.RangeAnalysisViewModel;
import com.floyd.lottoptions.bff.viewmodel.RangePerformanceMetricsViewModel;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse.DrawResult;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse.GameConfiguration;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse.PositionAnalysis;
import com.floyd.lottoptions.core.contract.range.RangeAnalysisResponse.RangePerformanceMetrics;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Assembler that projects a Core API {@link RangeAnalysisResponse} into a slim
 * {@link RangeAnalysisViewModel} for delivery to the Angular range-analysis screen (FR-016-D).
 *
 * <p>This assembler is a <em>pure relay/slimmer</em>: it projects only the fields that the
 * Angular screen renders. It performs no domain logic and derives no values that are not
 * present in the Core response (FR-016 Section 1.2 constraint (j)).</p>
 *
 * <p>Two fields are <em>synthesized</em> from map keys because the Core uses maps whose keys
 * are the identifying labels but whose value objects do not contain those labels as fields:
 * <ul>
 *   <li>{@link RangePerformanceMetricsViewModel#range()} - synthesized from the
 *       {@code Map<String, RangePerformanceMetrics>} entry key.</li>
 *   <li>{@link PositionAnalysisViewModel#position()} - synthesized from the
 *       {@code Map<String, PositionAnalysis>} entry key.</li>
 * </ul>
 * </p>
 *
 * <p>{@link RangePerformanceMetricsViewModel#status()} is relayed as a {@code String}
 * via {@code RangeStatus.name()} to decouple the BFF's serialized contract from the Core
 * model's enum type (ADR - status-as-String).</p>
 *
 * <p>{@link DrawResultViewModel#totalHits()} is relayed directly from
 * {@code DrawResult.totalHits} - it is NEVER recomputed in this assembler.</p>
 *
 * <p>Null {@code performanceMetrics} or {@code positionAnalysis} maps on the Core response
 * produce {@link List#of()} (Effective Java Item 54).</p>
 *
 * <p>This class is {@code final} and stateless; it is a Spring {@link Component} wired into
 * {@link com.floyd.lottoptions.bff.service.RangeAnalysisService} via constructor injection
 * (Effective Java Items 5, 17).</p>
 */
@Component
public final class RangeAnalysisAssembler {

    /**
     * Assembles a {@link RangeAnalysisViewModel} from the given Core API response.
     *
     * @param response the Core API range-analysis response; must not be {@code null}
     * @return a fully populated {@link RangeAnalysisViewModel}; never {@code null}
     * @throws NullPointerException if {@code response} is {@code null}
     */
    public RangeAnalysisViewModel assemble(RangeAnalysisResponse response) {
        Objects.requireNonNull(response, "response must not be null");

        return new RangeAnalysisViewModel(
                toGameConfiguration(response.gameConfiguration()),
                response.rangeHeaders() != null ? response.rangeHeaders() : List.of(),
                response.totalDrawsAnalyzed(),
                toDrawResults(response.drawResults()),
                toPerformanceMetrics(response.performanceMetrics()),
                toPositionAnalysis(response.positionAnalysis())
        );
    }

    // -------------------------------------------------------------------------
    // Package-private helpers (non-static, testable without subclassing)
    // -------------------------------------------------------------------------

    /**
     * Projects a {@link GameConfiguration} to a {@link GameConfigurationViewModel}.
     *
     * <p>If {@code config} is {@code null}, an empty/zero-value ViewModel is returned
     * rather than {@code null} (Effective Java Item 54).</p>
     *
     * @param config the Core game configuration; may be {@code null}
     * @return a non-null {@link GameConfigurationViewModel}
     */
    GameConfigurationViewModel toGameConfiguration(GameConfiguration config) {
        if (config == null) {
            return new GameConfigurationViewModel(
                    null, null, null, 0, null, 0, List.of());
        }
        return new GameConfigurationViewModel(
                config.state(),
                config.game(),
                config.numberRange(),
                config.totalNumbers(),
                config.analysisType(),
                config.rangeSize(),
                config.analyzedPositions() != null ? config.analyzedPositions() : List.of()
        );
    }

    /**
     * Projects a list of {@link DrawResult} objects to a list of {@link DrawResultViewModel} objects.
     *
     * <p>{@code totalHits} is relayed from each {@link DrawResult#totalHits()} - NEVER
     * recomputed in this assembler (FR-016-D constraint).</p>
     *
     * @param drawResults the Core draw results; may be {@code null}
     * @return a non-null list of {@link DrawResultViewModel}
     */
    List<DrawResultViewModel> toDrawResults(List<DrawResult> drawResults) {
        if (drawResults == null) {
            return List.of();
        }
        return drawResults.stream()
                .map(dr -> new DrawResultViewModel(
                        dr.drawDate(),
                        dr.rangeHits() != null ? dr.rangeHits() : Map.of(),
                        dr.totalHits(),
                        dr.analyzedNumbers() != null ? dr.analyzedNumbers() : List.of()
                ))
                .toList();
    }

    /**
     * Projects the {@code Map<String, RangePerformanceMetrics>} from the Core response
     * into a list of {@link RangePerformanceMetricsViewModel} objects.
     *
     * <p>The map <em>key</em> (range label, e.g. {@code "1-5"}) is synthesized as the
     * {@code range} component on each view model - this field is NOT present on the
     * Core's {@link RangePerformanceMetrics} value object (FR-016-D, gap resolution).</p>
     *
     * <p>Returns {@link List#of()} when the map is {@code null} or empty
     * (Effective Java Item 54).</p>
     *
     * @param metricsMap the Core performance-metrics map; may be {@code null}
     * @return a non-null list of {@link RangePerformanceMetricsViewModel}
     */
    List<RangePerformanceMetricsViewModel> toPerformanceMetrics(
            Map<String, RangePerformanceMetrics> metricsMap) {
        if (metricsMap == null || metricsMap.isEmpty()) {
            return List.of();
        }
        return metricsMap.entrySet().stream()
                .map(entry -> {
                    String range = entry.getKey();
                    RangePerformanceMetrics m = entry.getValue();
                    return new RangePerformanceMetricsViewModel(
                            range,
                            m.totalHits(),
                            m.hitFrequency(),
                            m.avgGapBetweenHits(),
                            m.currentStreak(),
                            m.lastHitDraw(),
                            m.status() != null ? m.status().name() : null,
                            m.daysSinceLastHit(),
                            m.expectedProbability(),
                            m.gapVariance()
                    );
                })
                .toList();
    }

    /**
     * Projects the {@code Map<String, PositionAnalysis>} from the Core response
     * into a list of {@link PositionAnalysisViewModel} objects.
     *
     * <p>The map <em>key</em> (position label, e.g. {@code "1"}) is synthesized as the
     * {@code position} component on each view model - this field is NOT present on the
     * Core's {@link PositionAnalysis} value object (FR-016-D, gap resolution).</p>
     *
     * <p>Returns {@link List#of()} when the map is {@code null} or empty
     * (Effective Java Item 54).</p>
     *
     * @param positionMap the Core position-analysis map; may be {@code null}
     * @return a non-null list of {@link PositionAnalysisViewModel}
     */
    List<PositionAnalysisViewModel> toPositionAnalysis(
            Map<String, PositionAnalysis> positionMap) {
        if (positionMap == null || positionMap.isEmpty()) {
            return List.of();
        }
        return positionMap.entrySet().stream()
                .map(entry -> {
                    String position = entry.getKey();
                    PositionAnalysis pa = entry.getValue();
                    return new PositionAnalysisViewModel(
                            position,
                            pa.mostLikelyRanges() != null ? pa.mostLikelyRanges() : List.of(),
                            pa.leastLikelyRanges() != null ? pa.leastLikelyRanges() : List.of(),
                            pa.rangeFrequencies() != null ? pa.rangeFrequencies() : Map.of(),
                            pa.averageValue(),
                            pa.standardDeviation(),
                            pa.lastDrawnNumber()
                    );
                })
                .toList();
    }
}
