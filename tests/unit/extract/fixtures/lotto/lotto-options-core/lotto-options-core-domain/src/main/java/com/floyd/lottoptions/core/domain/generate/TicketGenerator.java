package com.floyd.lottoptions.core.domain.generate;

import java.util.List;

/**
 * Generates tickets for one game by one generation strategy.
 */
@FunctionalInterface
public interface TicketGenerator {

    /**
     * Generates a new batch of tickets; every call draws again.
     *
     * @return the tickets, one {@code int[]} of numbers each; the caller may keep the list
     * @throws java.util.concurrent.CancellationException if the generator stops because the
     *                                                    calling thread was interrupted
     */
    List<int[]> generate();
}
