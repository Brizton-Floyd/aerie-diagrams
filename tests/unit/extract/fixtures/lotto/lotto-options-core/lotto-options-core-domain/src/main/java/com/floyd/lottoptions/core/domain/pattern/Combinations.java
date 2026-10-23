package com.floyd.lottoptions.core.domain.pattern;

/**
 * Binomial coefficients for the probability calculators.
 */
final class Combinations {

    private Combinations() {
    }

    /**
     * The ways to choose {@code r} of {@code n} items, {@code n choose r}; {@code 0} when
     * {@code r} is negative or above {@code n}. Overflows silently above the {@code long} range.
     */
    static long choose(int n, int r) {
        if (r < 0 || r > n) {
            return 0;
        }
        if (r == 0 || r == n) {
            return 1;
        }
        int smaller = r > n / 2 ? n - r : r;
        long result = 1;
        for (int i = 1; i <= smaller; i++) {
            result = result * (n - i + 1) / i;
        }
        return result;
    }

    /**
     * The ways to choose {@code r} of {@code n} items when an item may be chosen again,
     * {@code (n + r - 1) choose r}.
     */
    static long chooseWithRepetition(int n, int r) {
        return choose(n + r - 1, r);
    }
}
