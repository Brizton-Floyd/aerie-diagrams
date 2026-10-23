package com.floyd.lottoptions.core.domain.range;

/**
 * One range of numbers, both ends included, for example 11-20.
 *
 * @param first the range's smallest number
 * @param last  the range's largest number
 */
public record Range(int first, int last) {

    /**
     * @return the range as {@code first-last}, for example {@code 11-20}
     */
    public String label() {
        return first + "-" + last;
    }
}
