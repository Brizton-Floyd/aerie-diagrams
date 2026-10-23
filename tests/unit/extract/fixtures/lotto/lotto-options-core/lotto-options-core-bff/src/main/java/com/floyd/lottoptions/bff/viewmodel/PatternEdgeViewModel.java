package com.floyd.lottoptions.bff.viewmodel;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Walk-forward pattern edge detector result view model (FR-015).
 *
 * <p>Reports whether the top-N decade-bucket fingerprints have a statistically
 * significant out-of-sample predictive edge over the combinatorial chance baseline
 * (hypergeometric distribution). For a fair, independent lottery the correct answer
 * is always "No edge" - this record must honestly report that null result.</p>
 *
 * <p>Java Record - inherently immutable and {@code final} (Effective Java Item 17).
 * No Lombok.</p>
 *
 * @param observedHitRate fraction of tested draws where the actual fingerprint appeared
 *                        in the top-N predicted set; range [0, 1]
 * @param chanceHitRate   expected hit rate under the null hypothesis (combinatorial
 *                        baseline derived from hypergeometric probability); range [0, 1]
 * @param edgePoints      {@code (observedHitRate − chanceHitRate) × 100}; expressed in
 *                        percentage points; positive values indicate the observed rate
 *                        exceeds chance
 * @param zScore          standardised z-score from the Poisson-binomial normal
 *                        approximation: {@code (hits − expected) / sqrt(variance)}
 * @param pValue          two-sided p-value from the standard normal CDF approximation
 *                        (Abramowitz & Stegun, A&S 26.2.17); range [0, 1]; a value
 *                        of 1.0 is returned in insufficient-data / guard cases
 * @param isSignificant   {@code true} iff {@code pValue < 0.05} AND {@code edgePoints > 0}
 * @param verdict         human-readable summary:
 *                        {@code "Edge +X.X pts (p=Y.YYYY)"} when significant,
 *                        {@code "No edge - patterns don't beat chance"} otherwise,
 *                        or {@code "Insufficient data"} for degenerate / guard cases
 * @param testedDraws     number of draws actually tested in the walk-forward pass
 *                        (total draws minus {@code warmupDraws})
 * @param topN            the top-N parameter echoed back for UI display
 * @param warmupDraws     the warmup-draws parameter echoed back for UI display
 */
@Schema(description = "Walk-forward pattern edge detector result. Reports whether top-N " +
        "decade-bucket fingerprints have a statistically significant out-of-sample predictive edge.")
public record PatternEdgeViewModel(
        @Schema(description = "Observed hit rate: fraction of tested draws where the actual fingerprint " +
                "appeared in the top-N predicted set. Range [0, 1].")
        double observedHitRate,

        @Schema(description = "Chance hit rate: expected fraction under the combinatorial null hypothesis " +
                "(hypergeometric baseline). Range [0, 1].")
        double chanceHitRate,

        @Schema(description = "Edge in percentage points: (observedHitRate − chanceHitRate) × 100. " +
                "Positive values indicate the observed rate exceeds chance.")
        double edgePoints,

        @Schema(description = "Standardised z-score from the Poisson-binomial normal approximation.")
        double zScore,

        @Schema(description = "Two-sided p-value from the standard normal CDF approximation " +
                "(Abramowitz & Stegun A&S 26.2.17). Range [0, 1].")
        double pValue,

        @Schema(description = "True iff pValue < 0.05 AND edgePoints > 0.")
        boolean isSignificant,

        @Schema(description = "Human-readable verdict: 'Edge +X.X pts (p=Y.YYYY)' when significant, " +
                "'No edge - patterns don't beat chance' otherwise, or 'Insufficient data' for guard cases.")
        String verdict,

        @Schema(description = "Number of draws tested in the walk-forward pass (total − warmupDraws).")
        int testedDraws,

        @Schema(description = "The top-N parameter echoed back for UI display.")
        int topN,

        @Schema(description = "The warmup-draws parameter echoed back for UI display.")
        int warmupDraws
) {}
