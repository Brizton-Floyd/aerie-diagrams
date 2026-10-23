package com.floyd.lottoptions.core.contract.dashboard;

/**
 * How one odd/even or high/low pattern fared over the draw history.
 *
 * @param pattern                  the pattern, for example {@code 3 Odd 2 Even}
 * @param frequency                the draws that showed the pattern
 * @param probability              the chance that one draw shows the pattern, rounded to 3
 *                                 decimals
 * @param estimatedHitFrequency    the draws expected to show it, rounded to 3 decimals
 * @param gamesSinceLastAppearance the draws since the pattern last showed
 */
public record PatternAnalysisResult(String pattern, int frequency, double probability,
                                    double estimatedHitFrequency, int gamesSinceLastAppearance) {}
