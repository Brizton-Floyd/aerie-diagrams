package com.floyd.lottoptions.service;

import com.floyd.persistence.model.LotteryGame;
import com.floyd.persistence.model.LotteryState;
import com.floyd.persistence.model.request.StateGameAnalysisRequest;
import com.floyd.persistence.model.response.AllStateLottoGameResponse;
import com.floyd.persistence.model.response.StateGamesResponse;

import java.util.List;
import java.util.Optional;

public interface DataService {
    Optional<StateGamesResponse> getStateData(StateGameAnalysisRequest stateGameAnalysisRequest) throws Exception;
    Optional<AllStateLottoGameResponse> getAllStateLotteryGames() throws Exception;
    Optional<AllStateLottoGameResponse> getAllStateLotteryGamesV2() throws Exception;
    Optional<List<String>> getAllStateLotteryGames(String state) throws Exception;

    List<LotteryState> fetchStates();

    List<LotteryGame> fetchStateGames(String stateName);
}
