package com.floyd.lottoptions.core.domain.pattern;

import java.util.Objects;

/**
 * How one odd/even or high/low pattern fared over a draw history.
 *
 * @param pattern                  the pattern, for example {@code 3 Odd 2 Even}
 * @param frequency                the draws that showed the pattern
 * @param probability              the chance that one draw shows the pattern, rounded to 3
 *                                 decimals
 * @param estimatedHitFrequency    the draws expected to show it ({@code probability} before
 *                                 rounding, times the history's draws), rounded to 3 decimals
 * @param gamesSinceLastAppearance the draws since the pattern last showed: {@code 0} when the
 *                                 latest draw showed it
 */
public record PatternStatistics(String pattern, int frequency, double probability,
                                double estimatedHitFrequency, int gamesSinceLastAppearance) {

    public PatternStatistics {
        Objects.requireNonNull(pattern, "pattern");
    }
}
