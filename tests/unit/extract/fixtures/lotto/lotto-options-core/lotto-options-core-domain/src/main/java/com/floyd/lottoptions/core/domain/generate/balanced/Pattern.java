package com.floyd.lottoptions.core.domain.generate.balanced;

import java.math.BigDecimal;

/**
 * One balanced spread of a game: how many of a ticket's numbers fall in each of the four
 * categories low-odd, low-even, high-odd and high-even, with the spread's theoretical
 * probability and how it fared in the draw history.
 *
 * <p>A number is low up to the {@linkplain #midpoint() midpoint} and high above it. The hit
 * statistics are updated by {@link DrawAnalyzer}; everything else is fixed.</p>
 */
public final class Pattern {

    private final int lowerOdd;
    private final int lowerEven;
    private final int upperOdd;
    private final int upperEven;
    private final BigDecimal probability;
    private final double expectedElapsedTime;
    private final int midpoint;
    private int hitCount;
    private int gamesOut;

    /**
     * @param lowerOdd    the count of low odd numbers
     * @param lowerEven   the count of low even numbers
     * @param upperOdd    the count of high odd numbers
     * @param upperEven   the count of high even numbers
     * @param probability the chance that a draw has this spread
     * @param midpoint    the largest low number
     */
    public Pattern(int lowerOdd, int lowerEven, int upperOdd, int upperEven, double probability, int midpoint) {
        this.lowerOdd = lowerOdd;
        this.lowerEven = lowerEven;
        this.upperOdd = upperOdd;
        this.upperEven = upperEven;
        this.probability = BigDecimal.valueOf(probability);
        this.expectedElapsedTime = probability > 0 ? 1 / probability : Double.POSITIVE_INFINITY;
        this.midpoint = midpoint;
    }

    /**
     * Tells whether a draw's numbers have this spread.
     *
     * @param draw the numbers
     * @return {@code true} when the draw has as many numbers in each category as this spread
     */
    public boolean matches(int[] draw) {
        int lo = 0;
        int le = 0;
        int uo = 0;
        int ue = 0;
        for (int num : draw) {
            if (num <= midpoint) {
                if (num % 2 == 0) {
                    le++;
                } else {
                    lo++;
                }
            } else if (num % 2 == 0) {
                ue++;
            } else {
                uo++;
            }
        }
        return lo == lowerOdd && le == lowerEven && uo == upperOdd && ue == upperEven;
    }

    void incrementHitCount() {
        hitCount++;
    }

    void resetGamesOut() {
        gamesOut = 0;
    }

    void incrementGamesOut() {
        gamesOut++;
    }

    /** @return the count of low odd numbers */
    public int lowerOdd() {
        return lowerOdd;
    }

    /** @return the count of low even numbers */
    public int lowerEven() {
        return lowerEven;
    }

    /** @return the count of high odd numbers */
    public int upperOdd() {
        return upperOdd;
    }

    /** @return the count of high even numbers */
    public int upperEven() {
        return upperEven;
    }

    /** @return how many numbers a ticket of this spread has: the four counts added up */
    public int totalNumbers() {
        return lowerOdd + lowerEven + upperOdd + upperEven;
    }

    /** @return the chance that a draw has this spread */
    public BigDecimal probability() {
        return probability;
    }

    /** @return the draws a hit is expected to take, {@code 1 / probability}; infinite for an impossible spread */
    public double expectedElapsedTime() {
        return expectedElapsedTime;
    }

    /** @return the largest low number */
    public int midpoint() {
        return midpoint;
    }

    /** @return how many analyzed draws had this spread */
    public int hitCount() {
        return hitCount;
    }

    /** @return how many analyzed draws came after the last one with this spread */
    public int gamesOut() {
        return gamesOut;
    }

    /** @return the spread as low odd-low even-high odd-high even, for example {@code 2-1-1-1} */
    @Override
    public String toString() {
        return lowerOdd + "-" + lowerEven + "-" + upperOdd + "-" + upperEven;
    }
}
