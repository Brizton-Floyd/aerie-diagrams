package com.floyd.lottoptions.agr.polling;

/**
 * Published after a poll cycle finishes writing (or attempting to write) draw results.
 * Read-side components listen for this to invalidate caches that were built from the
 * {@code .ser} store, so a freshly-polled catalog becomes visible on the next request.
 *
 * @param gamesSucceeded        number of games that were fetched and serialized with every source row parsed
 * @param gamesWithRejectedRows number of games that were serialized but had source rows rejected as unparseable
 * @param gamesFailed           number of games that failed after retries (isolated, non-fatal)
 */
public record PollCompletedEvent(int gamesSucceeded, int gamesWithRejectedRows, int gamesFailed) {
}
