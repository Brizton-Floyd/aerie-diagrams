package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.HighLowSummaryViewModel;
import com.floyd.lottoptions.bff.viewmodel.OddEvenSummaryViewModel;
import com.floyd.lottoptions.bff.viewmodel.PatternSummaryEntryViewModel;
import com.floyd.lottoptions.core.contract.dashboard.PatternAnalysisResult;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Pure assembler that projects the Probability Estimation panel data from the
 * {@code DashboardResponse} odd/even and high/low pattern maps.
 *
 * <p>Replaces the {@code projectPatternMap} private helper from the original monolithic
 * {@code DashboardViewModelAssembler} (FR-006-D, ADR-0003). Provides full five-column
 * parity with the desktop (DashBoardController.java:409–413): pattern, frequency,
 * probability, estimatedHitFrequency, gamesSinceLastAppearance.</p>
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). Constructor injection
 * is not required - no dependencies. No I/O, no reactive types.</p>
 */
@Component
public final class OddEvenHighLowAssembler {

    /**
     * Projects the odd/even pattern map into an {@link OddEvenSummaryViewModel}.
     *
     * @param map the {@code DashboardResponse.oddEvenPatterns} map; must not be {@code null}
     * @return summary with patterns sorted by key; empty patterns list if map is empty
     */
    public OddEvenSummaryViewModel buildOddEvenSummary(Map<String, PatternAnalysisResult> map) {
        Objects.requireNonNull(map, "oddEvenPatterns map must not be null");
        return new OddEvenSummaryViewModel(projectPatternMap(map));
    }

    /**
     * Projects the high/low pattern map into a {@link HighLowSummaryViewModel}.
     *
     * @param map the {@code DashboardResponse.highLowPatterns} map; must not be {@code null}
     * @return summary with patterns sorted by key; empty patterns list if map is empty
     */
    public HighLowSummaryViewModel buildHighLowSummary(Map<String, PatternAnalysisResult> map) {
        Objects.requireNonNull(map, "highLowPatterns map must not be null");
        return new HighLowSummaryViewModel(projectPatternMap(map));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Converts a {@code Map<String, PatternAnalysisResult>} to a
     * {@code List<PatternSummaryEntryViewModel>} sorted by key.
     * Returns {@code List.of()} when the map is empty (Effective Java Item 54).
     */
    private List<PatternSummaryEntryViewModel> projectPatternMap(
            Map<String, PatternAnalysisResult> map) {
        if (map.isEmpty()) {
            return List.of();
        }
        return map.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new PatternSummaryEntryViewModel(
                        e.getKey(),
                        e.getValue().frequency(),
                        e.getValue().probability(),
                        e.getValue().estimatedHitFrequency(),
                        e.getValue().gamesSinceLastAppearance()))
                .toList();
    }
}
