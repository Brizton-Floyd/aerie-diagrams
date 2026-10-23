package com.floyd.persistence.model.response;

import com.floyd.persistence.model.LotteryState;
import lombok.Data;

import java.util.List;

@Data
public class StateResponse {
    private List<LotteryState> data;
}
