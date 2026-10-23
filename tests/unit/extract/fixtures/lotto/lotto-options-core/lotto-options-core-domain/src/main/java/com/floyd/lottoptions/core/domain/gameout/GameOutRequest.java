package com.floyd.lottoptions.core.domain.gameout;

import com.floyd.lottoptions.core.domain.game.GameId;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * A request for one game's next-draw recommendation. A request that breaks a rule is never
 * built: the constructor throws {@link IllegalArgumentException}, which the Core API answers
 * with 400.
 *
 * @param gameId                       the game's full name (for example {@code Pick 3 Day})
 * @param state                        the state's name (for example {@code Texas})
 * @param betLevel                     the stake per combination, at least {@code 0.25}
 * @param maxGameOut                   the largest game-out value that still plays; {@code null}
 *                                     only with {@code autoOptimizeGameOut}, and then 15
 * @param hPoolSize                    the size of a position's pool when the pattern hits it
 * @param mPoolSize                    the size of a position's pool when the pattern misses it
 * @param includeHistoricalPerformance whether to replay the history and add coverage analysis
 * @param performanceYear              the one year to replay, when {@code performanceYears} is
 *                                     not given
 * @param performanceYears             the years to replay; neither given replays the clock's year
 * @param startingBalance              the replay's starting balance; {@code null} for 20000.00
 * @param poolSize                     a large-pool game's whole-number pool size; {@code null}
 *                                     for 20 on a 6-number game and 15 otherwise
 * @param autoOptimizeGameOut          whether {@code maxGameOut} may be left out
 */
public record GameOutRequest(
        String gameId,
        String state,
        BigDecimal betLevel,
        Integer maxGameOut,
        Integer hPoolSize,
        Integer mPoolSize,
        boolean includeHistoricalPerformance,
        Integer performanceYear,
        List<Integer> performanceYears,
        BigDecimal startingBalance,
        Integer poolSize,
        boolean autoOptimizeGameOut) {

    /** The threshold used when {@code maxGameOut} is left out. */
    private static final int DEFAULT_MAX_GAME_OUT = 15;

    /**
     * @throws IllegalArgumentException if the request breaks a rule
     */
    public GameOutRequest {
        if (gameId == null || gameId.trim().isEmpty()) {
            throw new IllegalArgumentException("gameId cannot be null or empty");
        }
        if (state == null || state.trim().isEmpty()) {
            throw new IllegalArgumentException("state cannot be null or empty");
        }
        if (betLevel == null) {
            throw new IllegalArgumentException("betLevel cannot be null");
        }
        if (betLevel.compareTo(new BigDecimal("0.25")) < 0) {
            throw new IllegalArgumentException("betLevel must be at least 0.25");
        }
        if (!autoOptimizeGameOut && (maxGameOut == null || maxGameOut < 1)) {
            throw new IllegalArgumentException("maxGameOut must be at least 1 (or set autoOptimizeGameOut to true)");
        }
        if (maxGameOut != null && maxGameOut < 1) {
            throw new IllegalArgumentException("maxGameOut must be at least 1");
        }
        if (hPoolSize != null && hPoolSize < 1) {
            throw new IllegalArgumentException("hPoolSize must be at least 1");
        }
        if (mPoolSize != null && mPoolSize < 1) {
            throw new IllegalArgumentException("mPoolSize must be at least 1");
        }
        if (poolSize != null && (poolSize < 10 || poolSize > 50)) {
            throw new IllegalArgumentException("poolSize must be between 10 and 50");
        }
        performanceYears = performanceYears == null
                ? null : Collections.unmodifiableList(new ArrayList<>(performanceYears));
    }

    /**
     * @return the game the request is for
     */
    public GameId game() {
        return new GameId(state, gameId);
    }

    /**
     * @return {@code maxGameOut}, or 15 when it is left out
     */
    public int maxGameOutOrDefault() {
        return maxGameOut != null ? maxGameOut : DEFAULT_MAX_GAME_OUT;
    }
}
