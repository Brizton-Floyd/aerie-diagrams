package com.floyd.persistence.model.response;

import lombok.Data;
import com.floyd.persistence.model.LotteryGame;

import java.util.List;

@Data
public class StateGamesResponse {
    List<LotteryGame> lotteryGames;
    LotteryGame lotteryGame;
}
