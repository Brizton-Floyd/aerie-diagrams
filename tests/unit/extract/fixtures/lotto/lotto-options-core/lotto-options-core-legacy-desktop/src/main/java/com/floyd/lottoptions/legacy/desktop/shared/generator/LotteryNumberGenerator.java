package com.floyd.lottoptions.legacy.desktop.shared.generator;

import java.util.List;

/**
 * Defines a contract for classes that generate lottery numbers.
 * Implementations of this interface are responsible for the logic of generating one or more sets of lottery numbers,
 * which can then be retrieved for further processing or display.
 */
public interface LotteryNumberGenerator {

    /**
     * Retrieves the list of generated lottery number sets.
     * Each `int[]` in the list represents a single lottery ticket or a set of generated numbers.
     *
     * @return A list of integer arrays, where each array is a set of generated lottery numbers.
     */
    List<int[]> getGeneratedNumbers();

    /**
     * Executes the lottery number generation process.
     * This method should contain the core logic for generating the numbers according to the specific strategy
     * of the implementing class.
     */
    void process();
}
