package com.floyd.persistence.model.response;

import com.floyd.persistence.model.LotteryGame;
import com.floyd.persistence.model.LotteryState;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AllStateLottoGameResponse {
    private Map<String, List<LotteryGame>> allStateLotteryGames;
    private List<LotteryState> lotteryStateGames;
}
