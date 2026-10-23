package com.floyd.lottoptions.agr.processor;

/**
 * Outcome of processing one game's source file, so the poller can tell a clean update
 * from one that was persisted with some source rows rejected as unparseable.
 *
 * @param rowsRead     number of source rows considered (after the most-recent-draws cap)
 * @param rowsRejected number of those rows that could not be parsed and were not stored
 */
public record GameProcessingResult(int rowsRead, int rowsRejected) {

    /** Reported by processors that do not track per-row rejections. */
    public static final GameProcessingResult UNTRACKED = new GameProcessingResult(0, 0);

    public boolean hasRejectedRows() {
        return rowsRejected > 0;
    }
}
