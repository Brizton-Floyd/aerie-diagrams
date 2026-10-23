package com.floyd.lottoptions.legacy.desktop.service.adapter;

import com.floyd.lottoptions.legacy.desktop.service.LotteryDataService;
import com.floyd.lottoptions.legacy.desktop.shared.service.LotteryStateService;
import com.floyd.persistence.model.response.StateGamesResponse;

import java.util.Optional;

/**
 * Adapter that implements LotteryDataService using the server's LotteryStateService.
 * This bridges the result-analyzer module with the server's lottery data access.
 */
public class LotteryDataServiceAdapter implements LotteryDataService {
    
    private final LotteryStateService lotteryStateService;
    
    /**
     * Constructs the adapter with the server's lottery state service.
     *
     * @param lotteryStateService The server's lottery state service
     */
    public LotteryDataServiceAdapter(LotteryStateService lotteryStateService) {
        this.lotteryStateService = lotteryStateService;
    }
    
    /**
     * Retrieves lottery game data using the server's lottery state service.
     *
     * @param game The lottery game name (e.g., "cash-five", "powerball")
     * @param state The state abbreviation (e.g., "texas", "california") 
     * @return Optional containing the game response if found
     */
    @Override
    public Optional<StateGamesResponse> getLotteryGameData(String game, String state) {
        return lotteryStateService.getLottoGameDrawData(game, state);
    }
}