package com.floyd.lottoptions.agr.processor;

import com.floyd.lottoptions.agr.config.LotteryUrlConfig;

import java.util.List;

public interface HistoryProcessor {
    void getHistoricalData(String name, List<LotteryUrlConfig.GameInfo> gameInfo) throws Exception;

    /**
     * Process a single game. This is the unit the poller parallelises and wraps with
     * retry / rate-limiting, so one game's failure can be isolated from the rest.
     * The default delegates to {@link #getHistoricalData} with a one-element list for
     * processors that have not specialised it, and reports {@link GameProcessingResult#UNTRACKED}.
     *
     * @return how many source rows were read and how many were rejected as unparseable
     */
    default GameProcessingResult processGame(String stateName, LotteryUrlConfig.GameInfo gameInfo) throws Exception {
        getHistoricalData(stateName, List.of(gameInfo));
        return GameProcessingResult.UNTRACKED;
    }
}
