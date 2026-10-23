package com.floyd.lottoptions.core.domain.gameout;

import java.util.List;
import java.util.Set;

/**
 * Pure, stateless analyzer of how well a candidate number pool covers history (FR-026).
 *
 * <p>Scans the historical draws and counts full traps and near misses (one/two
 * numbers short of a full hit) against a global pool, producing the coverage
 * counts and rates surfaced in a PLAY recommendation.</p>
 *
 * <p>Extracted verbatim from {@code GameOutRecommendationService}; behavior is
 * identical. A plain stateless class (ADR-0008): a single instance is safely
 * shared and trivially unit-testable.</p>
 */
public final class CoverageAnalyzer {

    public CoverageAnalysis calculateCoverageAnalysis(
            Set<Integer> poolNumbers,
            List<List<Integer>> historicalDraws,
            int gameSize) {

        int totalDraws = historicalDraws.size();
        int fullTraps = 0;
        int minus1Traps = 0;
        int minus2Traps = 0;

        for (List<Integer> draw : historicalDraws) {
            int matchCount = 0;

            for (int i = 0; i < Math.min(gameSize, draw.size()); i++) {
                if (poolNumbers.contains(draw.get(i))) {
                    matchCount++;
                }
            }

            if (matchCount == gameSize) {
                fullTraps++;
            } else if (matchCount == gameSize - 1) {
                minus1Traps++;
            } else if (matchCount == gameSize - 2) {
                minus2Traps++;
            }
        }

        return new CoverageAnalysis(
            totalDraws,
            fullTraps,
            minus1Traps,
            minus2Traps,
            totalDraws > 0 ? (fullTraps * 100.0 / totalDraws) : 0.0,
            totalDraws > 0 ? (minus1Traps * 100.0 / totalDraws) : 0.0,
            totalDraws > 0 ? (minus2Traps * 100.0 / totalDraws) : 0.0);
    }
}
