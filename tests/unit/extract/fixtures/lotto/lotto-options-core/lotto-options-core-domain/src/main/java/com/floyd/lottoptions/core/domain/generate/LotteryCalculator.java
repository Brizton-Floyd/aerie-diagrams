package com.floyd.lottoptions.core.domain.generate;

import java.math.BigInteger;

/**
 * The expected wait for a prize level: how many drawings, or days, a set of tickets played every
 * drawing takes on average to win it.
 */
public final class LotteryCalculator {

    private static final int DAYS_PER_WEEK = 7;

    private LotteryCalculator() {
    }

    /**
     * The expected days before winning: the expected drawings spread over the game's draw days.
     *
     * @param totalNumbers           the numbers of the field
     * @param numbersDrawn           the numbers drawn per drawing
     * @param ticketsBought          the tickets played each drawing
     * @param targetedCorrectNumbers the correct numbers needed to win
     * @param drawingsPerWeek        the game's drawings per week
     * @return the expected days before winning
     */
    public static double calculateExpectedDaysToWin(int totalNumbers, int numbersDrawn, int ticketsBought,
                                                    int targetedCorrectNumbers, int drawingsPerWeek) {
        double expectedDrawings =
                calculateExpectedDrawingsToWin(totalNumbers, numbersDrawn, ticketsBought, targetedCorrectNumbers);
        return (expectedDrawings / drawingsPerWeek) * DAYS_PER_WEEK;
    }

    /**
     * The expected drawings before winning: the reciprocal of the chance that any of the tickets
     * wins a drawing.
     *
     * @param totalNumbers           the numbers of the field
     * @param numbersDrawn           the numbers drawn per drawing
     * @param ticketsBought          the tickets played each drawing
     * @param targetedCorrectNumbers the correct numbers needed to win
     * @return the expected drawings before winning
     */
    public static double calculateExpectedDrawingsToWin(int totalNumbers, int numbersDrawn, int ticketsBought,
                                                        int targetedCorrectNumbers) {
        BigInteger totalCombinations = binomialCoefficient(totalNumbers, numbersDrawn);
        BigInteger favorableCombinations = binomialCoefficient(numbersDrawn, targetedCorrectNumbers)
                .multiply(binomialCoefficient(totalNumbers - numbersDrawn, numbersDrawn - targetedCorrectNumbers));

        double probability = favorableCombinations.doubleValue() / totalCombinations.doubleValue();
        // StrictMath: Math.pow may differ by an ulp between platforms, and the result is returned unrounded.
        double probabilityOfWinning = 1 - StrictMath.pow(1 - probability, ticketsBought);

        return 1 / probabilityOfWinning;
    }

    private static BigInteger binomialCoefficient(int n, int k) {
        BigInteger numerator = factorial(n);
        BigInteger denominator = factorial(k).multiply(factorial(n - k));
        return numerator.divide(denominator);
    }

    private static BigInteger factorial(int n) {
        BigInteger result = BigInteger.ONE;
        for (int i = 2; i <= n; i++) {
            result = result.multiply(BigInteger.valueOf(i));
        }
        return result;
    }
}
