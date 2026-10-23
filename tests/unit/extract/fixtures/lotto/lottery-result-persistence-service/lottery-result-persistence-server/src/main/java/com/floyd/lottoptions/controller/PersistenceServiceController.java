package com.floyd.lottoptions.controller;

import com.floyd.lottoptions.error.ResourceNotFoundException;
import com.floyd.lottoptions.service.DataService;
import com.floyd.persistence.model.LotteryGame;
import com.floyd.persistence.model.LotteryState;
import com.floyd.persistence.model.request.StateGameAnalysisRequest;
import com.floyd.persistence.model.response.AllStateLottoGameResponse;
import com.floyd.persistence.model.response.StateGamesResponse;
import com.floyd.persistence.model.response.StateResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class PersistenceServiceController {

    private static final Logger log = LoggerFactory.getLogger(PersistenceServiceController.class);

    private final DataService lotteryDataService;

    public PersistenceServiceController(DataService lotteryDataService) {
        this.lotteryDataService = lotteryDataService;
    }

    @GetMapping("/states")
    public Flux<StateResponse> getLotteryStates() {
        List<LotteryState> states = lotteryDataService.fetchStates();
        StateResponse stateResponse = new StateResponse();
        stateResponse.setData(states);
        return Flux.just(stateResponse);
    }

    @GetMapping("/states/{stateName}/games")
    public Flux<LotteryGame> getGames(@PathVariable String stateName) {
        return Flux.fromIterable(lotteryDataService.fetchStateGames(stateName));
    }

    @GetMapping("/all/state-games")
    ResponseEntity<AllStateLottoGameResponse> getAllUsStateGames() throws Exception {
        log.info("Received request for all state lotto games (v1)");
        return lotteryDataService.getAllStateLotteryGames()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(new AllStateLottoGameResponse()));
    }

    @GetMapping("/all/v2/state-games")
    ResponseEntity<AllStateLottoGameResponse> getAllUsStateGamesV2() throws Exception {
        log.info("Received request for all state lotto games (v2)");
        return lotteryDataService.getAllStateLotteryGamesV2()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(new AllStateLottoGameResponse()));
    }

    @GetMapping("/state-games/{state}")
    ResponseEntity<List<String>> getAllStateGames(@PathVariable String state) throws Exception {
        log.info("Received request for game names in state '{}'", state);
        return ResponseEntity.ok(lotteryDataService.getAllStateLotteryGames(state).orElseGet(List::of));
    }

    @PostMapping("/state/games")
    ResponseEntity<StateGamesResponse> requestResponse(@RequestBody StateGameAnalysisRequest request) throws Exception {
        log.info("Received request for state '{}' game '{}'", request.getStateName(), request.getGameName());
        StateGamesResponse response = lotteryDataService.getStateData(request)
                .orElseThrow(() -> notFound(request));
        if (response.getLotteryGame() == null) {
            throw notFound(request);
        }
        return ResponseEntity.ok(response);
    }

    private static ResourceNotFoundException notFound(StateGameAnalysisRequest request) {
        return new ResourceNotFoundException("No data for game '" + request.getGameName()
                + "' in state '" + request.getStateName() + "'");
    }
}
