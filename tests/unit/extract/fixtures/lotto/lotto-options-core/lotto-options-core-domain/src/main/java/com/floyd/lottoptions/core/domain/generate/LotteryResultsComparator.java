package com.floyd.lottoptions.core.domain.generate;

import com.floyd.lottoptions.core.domain.draw.Draw;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Back-tests tickets against a draw history: for every prize level, how often the tickets would
 * have hit it and how long ago they last did.
 *
 * <p>A game that draws {@code n} numbers has the prize levels 0 to {@code n}, where {@code n} is
 * the size of the history's first draw. A ticket matches a draw by the numbers they share, in any
 * order.</p>
 */
public final class LotteryResultsComparator {

    private final List<Set<Integer>> winningNumbersList;
    private final int numbersDrawn;

    /**
     * @param draws the draws to compare tickets with, in the order to count games out by: the
     *              last draw is the latest
     */
    public LotteryResultsComparator(List<Draw> draws) {
        this.winningNumbersList = draws.stream()
                .<Set<Integer>>map(draw -> new HashSet<>(draw.numbers()))
                .toList();
        this.numbersDrawn = draws.isEmpty() ? 0 : draws.get(0).numbers().size();
    }

    /**
     * Compares the tickets with every draw.
     *
     * @param tickets the tickets
     * @return every prize level, from 0 correct numbers up
     */
    public List<PrizeLevel> compare(List<int[]> tickets) {
        int levels = numbersDrawn + 1;
        int[] hits = new int[levels];
        int[] lastHitGame = new int[levels];

        int currentGame = 0;
        for (Set<Integer> winningNumbers : winningNumbersList) {
            currentGame++;
            for (int[] ticket : tickets) {
                int matches = (int) Arrays.stream(ticket).filter(winningNumbers::contains).count();
                if (matches < levels) {
                    hits[matches]++;
                    lastHitGame[matches] = currentGame;
                }
            }
        }

        List<PrizeLevel> prizeLevels = new ArrayList<>(levels);
        for (int level = 0; level < levels; level++) {
            prizeLevels.add(new PrizeLevel(level, hits[level], currentGame - lastHitGame[level]));
        }
        return prizeLevels;
    }
}
