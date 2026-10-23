package com.floyd.lottoptions.legacy.desktop.service;

import com.floyd.persistence.model.LotteryGame;
import com.floyd.persistence.model.response.StateGamesResponse;

import java.util.Optional;

/**
 * Service interface for fetching lottery game data.
 * This interface abstracts lottery data access for the result-analyzer module.
 */
public interface LotteryDataService {
    
    /**
     * Retrieves lottery game data for the specified state and game.
     *
     * @param game The lottery game name (e.g., "cash-five", "powerball")
     * @param state The state abbreviation (e.g., "texas", "california") 
     * @return Optional containing the game response if found
     */
    Optional<StateGamesResponse> getLotteryGameData(String game, String state);
    
    /**
     * Gets just the lottery game configuration without historical draws.
     *
     * @param game The lottery game name
     * @param state The state abbreviation
     * @return Optional containing the lottery game if found
     */
    default Optional<LotteryGame> getLotteryGame(String game, String state) {
        return getLotteryGameData(game, state)
                .map(StateGamesResponse::getLotteryGame);
    }
}