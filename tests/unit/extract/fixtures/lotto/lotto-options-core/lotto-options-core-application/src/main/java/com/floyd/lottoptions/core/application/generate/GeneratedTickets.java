package com.floyd.lottoptions.core.application.generate;

import java.util.List;

/**
 * The tickets a generate request settled on, with how they would have fared over the draw
 * history.
 *
 * @param tickets                                 the tickets, one {@code int[]} of numbers each
 * @param prizeLevels                             every prize level, from 0 correct numbers up
 * @param expectedDaysForTargetedPrizeLevelWin    the expected days before the first batch of
 *                                                tickets wins the targeted prize level, at most
 *                                                the number of draws
 */
public record GeneratedTickets(List<int[]> tickets, List<PrizeLevelOutcome> prizeLevels,
                               double expectedDaysForTargetedPrizeLevelWin) {

    public GeneratedTickets {
        tickets = List.copyOf(tickets);
        prizeLevels = List.copyOf(prizeLevels);
    }

    /**
     * One prize level of the tickets.
     *
     * @param correctNumbers        the prize level: its correct numbers
     * @param hits                  how many times, over all draws, a ticket matched exactly that
     *                              many
     * @param gamesOut              how many draws since a ticket last did
     * @param expectedDaysBeforeWin the expected days before the tickets win this level, rounded to
     *                              two decimals
     */
    public record PrizeLevelOutcome(int correctNumbers, int hits, int gamesOut, double expectedDaysBeforeWin) {
    }
}
