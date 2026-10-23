package com.floyd.lottoptions.core.domain.draw;

import com.floyd.lottoptions.core.domain.game.GameId;

import java.util.Optional;

/**
 * Where draw histories come from. Core's adapter reads them from the results service.
 */
public interface DrawHistorySource {

    /**
     * Loads one game's draw history.
     *
     * @param game the game to load
     * @return the game's history, or empty when the source answered without a game
     * @throws UnknownGameException           if the source has no such game in the state
     * @throws DrawHistoryUnavailableException if the source is down or failing
     */
    Optional<DrawHistory> load(GameId game);
}
