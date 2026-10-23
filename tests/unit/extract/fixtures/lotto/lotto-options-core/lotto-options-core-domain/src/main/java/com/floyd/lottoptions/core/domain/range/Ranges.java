package com.floyd.lottoptions.core.domain.range;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Buckets numbers into ranges of one size, from 1 up to a largest number: size 10 up to 35
 * gives 1-10, 11-20, 21-30 and 31-35, the last one cut short at the largest number.
 *
 * @param size          the numbers per range; greater than 0
 * @param largestNumber the largest number the ranges cover
 */
public record Ranges(int size, int largestNumber) {

    public Ranges {
        if (size <= 0) {
            throw new IllegalArgumentException("Range size must be greater than 0, got " + size);
        }
    }

    /**
     * @return every range, smallest first; none when the largest number is below 1
     */
    public List<Range> all() {
        List<Range> ranges = new ArrayList<>();
        for (long first = 1; first <= largestNumber; first += size) {
            ranges.add(new Range((int) first, (int) Math.min(first + size - 1, largestNumber)));
        }
        return ranges;
    }

    /**
     * Finds the range a number falls in. A number above the largest number gets a range that is
     * not among {@link #all()}, whose last number is the largest number: size 10 up to 35 puts
     * 41 in 41-35.
     *
     * @param number the number
     * @return the number's range, or empty for a number below 1
     */
    public Optional<Range> of(int number) {
        if (number <= 0) {
            return Optional.empty();
        }
        long first = (long) (number - 1) / size * size + 1;
        return Optional.of(new Range((int) first, (int) Math.min(first + size - 1, largestNumber)));
    }

    /**
     * Counts the numbers in each range. Numbers outside every range are not counted.
     *
     * @param numbers the numbers
     * @return every range with its count, smallest range first
     */
    public Map<Range, Integer> hits(List<Integer> numbers) {
        Map<Range, Integer> hits = new LinkedHashMap<>();
        for (Range range : all()) {
            hits.put(range, 0);
        }
        for (int number : numbers) {
            of(number).filter(hits::containsKey).ifPresent(range -> hits.merge(range, 1, Integer::sum));
        }
        return hits;
    }
}
