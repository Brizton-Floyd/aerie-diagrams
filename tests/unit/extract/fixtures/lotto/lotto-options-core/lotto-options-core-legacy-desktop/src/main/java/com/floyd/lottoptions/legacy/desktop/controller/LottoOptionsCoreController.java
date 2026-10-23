package com.floyd.lottoptions.legacy.desktop.controller;


import com.floyd.lottoptions.legacy.desktop.shared.service.LotteryStateService;
import com.floyd.persistence.model.response.StateGamesResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1")
public class LottoOptionsCoreController {
    private static final Logger log = LoggerFactory.getLogger(LottoOptionsCoreController.class);

    LotteryStateService lotteryStateService;

    public LottoOptionsCoreController(LotteryStateService lotteryStateService) {
        this.lotteryStateService = lotteryStateService;
    }


    @GetMapping("/lotto-options-core/games/{state}/{game}")
    @ResponseBody ResponseEntity<StateGamesResponse> getDataForLottoGame(@PathVariable String state, @PathVariable String game) {
        log.info("Received request to get game: {} for state: {}", game, state);
        try {
            final Optional<StateGamesResponse> gamesForStateByRegion =
                    lotteryStateService.getLottoGameDrawData(game, state);
            if (gamesForStateByRegion.isPresent()) {
                return new ResponseEntity<>(gamesForStateByRegion.get(), HttpStatus.OK);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
    }

    @GetMapping("/lotto-options-core/games/{state}")
    @ResponseBody ResponseEntity<List<?>> getAllGameNamesForState(@PathVariable String state) {
        log.info("Received request to get games for state: {}", state);
        try {
            final Optional<List<?>> gamesForStateByRegion =
                    lotteryStateService.getAllLottoGamesForState(state);
            if (gamesForStateByRegion.isPresent()) {
                return new ResponseEntity<>(gamesForStateByRegion.get(), HttpStatus.OK);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
    }
}
