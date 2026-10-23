package com.floyd.lottoptions.core.domain.pattern;

/**
 * How many numbers fall into each of a pattern's two groups: odd and even, or low and high.
 *
 * @param first  the numbers in the first group (odd, or low)
 * @param second the numbers in the second group (even, or high)
 */
public record Split(int first, int second) {
}
