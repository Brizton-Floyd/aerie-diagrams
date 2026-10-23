package com.floyd.lottoptions.core.domain.gameout;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * A request for a recommendation over every game of one state, within a budget. A request that
 * breaks a rule is never built: the constructor throws {@link IllegalArgumentException}, which
 * the Core API answers with 400.
 *
 * @param state                        the state's name (for example {@code Texas})
 * @param betLevel                     the stake per combination, at least {@code 0.25}
 * @param maxGameOut                   the largest game-out value that still plays, at least 1
 * @param hPoolSize                    the size of a position's pool when the pattern hits it
 * @param mPoolSize                    the size of a position's pool when the pattern misses it
 * @param accountBalance               the money available, more than 0
 * @param startingBalance              the replays' starting balance; {@code null} for the
 *                                     defaults of each replay
 * @param riskLevel                    the share of the account the play may spend
 * @param includeHistoricalPerformance whether to replay each game's history
 * @param performanceYears             the years to replay; {@code null} replays the clock's year
 */
public record MultiStateRequest(
        String state,
        BigDecimal betLevel,
        Integer maxGameOut,
        Integer hPoolSize,
        Integer mPoolSize,
        BigDecimal accountBalance,
        BigDecimal startingBalance,
        RiskLevel riskLevel,
        boolean includeHistoricalPerformance,
        List<Integer> performanceYears) {

    /**
     * @throws IllegalArgumentException if the request breaks a rule
     */
    public MultiStateRequest {
        if (state == null || state.trim().isEmpty()) {
            throw new IllegalArgumentException("state cannot be null or empty");
        }
        if (betLevel == null) {
            throw new IllegalArgumentException("betLevel cannot be null");
        }
        if (betLevel.compareTo(new BigDecimal("0.25")) < 0) {
            throw new IllegalArgumentException("betLevel must be at least 0.25");
        }
        if (maxGameOut == null || maxGameOut < 1) {
            throw new IllegalArgumentException("maxGameOut must be at least 1");
        }
        if (hPoolSize != null && hPoolSize < 1) {
            throw new IllegalArgumentException("hPoolSize must be at least 1");
        }
        if (mPoolSize != null && mPoolSize < 1) {
            throw new IllegalArgumentException("mPoolSize must be at least 1");
        }
        if (accountBalance == null) {
            throw new IllegalArgumentException("accountBalance cannot be null");
        }
        if (accountBalance.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("accountBalance must be greater than 0");
        }
        if (riskLevel == null) {
            throw new IllegalArgumentException("riskLevel cannot be null");
        }
        performanceYears = performanceYears == null
                ? null : Collections.unmodifiableList(new ArrayList<>(performanceYears));
    }

    /**
     * The request for one of the state's games, with this request's settings.
     *
     * @param gameId the game's full name
     * @return the game's request
     * @throws IllegalArgumentException if the game's request breaks a rule
     */
    public GameOutRequest forGame(String gameId) {
        return new GameOutRequest(gameId, state, betLevel, maxGameOut, hPoolSize, mPoolSize,
                includeHistoricalPerformance, null, performanceYears, startingBalance, null, false);
    }
}
