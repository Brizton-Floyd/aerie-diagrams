package com.floyd.lottoptions.core.domain.range;

import com.floyd.lottoptions.core.domain.game.GameFormat;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Which numbers of a draw a range analysis buckets.
 */
public enum AnalysisType {

    /**
     * The numbers drawn. A digit game's digits are encoded by position: the digit {@code d} at
     * position {@code i} (the first position is {@code 0}) counts as {@code d + 10 * i}, so each
     * position has its own band of ten, 0-9, 10-19, 20-29 and 30-39.
     */
    ACTUAL {
        @Override
        public List<Integer> analyze(List<Integer> drawn, GameFormat format) {
            if (format != GameFormat.DIGIT) {
                return new ArrayList<>(drawn);
            }
            List<Integer> encoded = new ArrayList<>(drawn.size());
            for (int position = 0; position < drawn.size(); position++) {
                encoded.add(drawn.get(position) + position * DIGITS_PER_POSITION);
            }
            return encoded;
        }

        @Override
        public int largestNumber(GameFormat format, int fieldLargest) {
            return format == GameFormat.DIGIT ? DIGIT_ENCODED_MAX : fieldLargest;
        }
    },

    /** The draw's {@link Deltas}. */
    DELTA {
        @Override
        public List<Integer> analyze(List<Integer> drawn, GameFormat format) {
            return Deltas.of(drawn);
        }
    },

    /** The draw's {@link Deltas}, smallest first. */
    DELTA_SORTED {
        @Override
        public List<Integer> analyze(List<Integer> drawn, GameFormat format) {
            List<Integer> deltas = Deltas.of(drawn);
            deltas.sort(Comparator.naturalOrder());
            return deltas;
        }
    };

    private static final int DIGITS_PER_POSITION = 10;

    /** The largest encoded number of a digit game: four positions of ten digits. */
    private static final int DIGIT_ENCODED_MAX = 39;

    /**
     * @param drawn  a draw's numbers, in the order the draw lists them
     * @param format the game's format
     * @return the numbers this analysis buckets, one per number drawn
     */
    public abstract List<Integer> analyze(List<Integer> drawn, GameFormat format);

    /**
     * The largest number the ranges cover: the field's, or 39 for a digit game's encoded
     * actual numbers. Deltas are bucketed up to the field's largest number too.
     *
     * @param format       the game's format
     * @param fieldLargest the largest number of the game's field
     * @return the largest number the ranges cover
     */
    public int largestNumber(GameFormat format, int fieldLargest) {
        return fieldLargest;
    }
}
