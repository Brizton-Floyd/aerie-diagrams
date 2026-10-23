package com.floyd.lottoptions.service;


import com.floyd.persistence.model.response.StateGamesResponse;

import java.util.Optional;

/**
 * Defines the service contract for interacting with lottery data related to specific states.
 * This service acts as a client to a persistence layer, fetching game and draw data.
 */
public interface LotteryStateService {
    /**
     * Retrieves historical draw data for a specific lottery game in a given state.
     *
     * @param game  The name of the lottery game.
     * @param state The abbreviation of the state.
     * @return An {@link Optional} containing the {@link StateGamesResponse} with game and draw data,
     *         or an empty Optional if not found.
     * @throws GameNotFoundException if the persistence service has no such game in the state
     * @throws ResultsServiceUnavailableException if the persistence service is down or failing
     */
    Optional<StateGamesResponse> getLottoGameDrawData(String game, String state);
}