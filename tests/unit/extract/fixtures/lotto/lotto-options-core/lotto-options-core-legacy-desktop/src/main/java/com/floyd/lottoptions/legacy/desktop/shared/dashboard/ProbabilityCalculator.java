package com.floyd.lottoptions.legacy.desktop.shared.dashboard;

import com.floyd.persistence.model.LotteryGame;

/**
 * Defines a strategy interface for calculating the probability of a given pattern occurring in a lottery game.
 * This allows for different probability calculation methods to be used interchangeably.
 */
public interface ProbabilityCalculator {

    /**
     * Calculates the probability of a specific pattern based on the game's rules and the distribution of numbers.
     *
     * @param numericalRepresentation The string representation of the pattern (e.g., "2 Low 4 High").
     * @param group1Count             The total count of numbers in the first group (e.g., low numbers).
     * @param group2Count             The total count of numbers in the second group (e.g., high numbers).
     * @param game                    The lottery game being analyzed.
     * @return The calculated probability of the pattern.
     */
    double calculate(String numericalRepresentation, int group1Count, int group2Count, LotteryGame game);
}
