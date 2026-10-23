package com.floyd.persistence.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Comparator;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LotteryGame implements Serializable {
    /**
     * Pinned to the value the JVM computed implicitly for this class as of the first
     * serialized {@code .ser} files, so existing persisted games keep deserializing and
     * future non-structural changes no longer risk {@link java.io.InvalidClassException}.
     */
    private static final long serialVersionUID = 8661963461273098644L;

    private String fullName;
    private String stateGameBelongsTo;
    private LocalDate dateLastUpdated;
    private Integer drawHistoryCount;
    private Integer drawPositionCount;
    private Integer maxNumber;
    private Integer minNumber;
    List<LotteryDraw> lotteryDraws;

    @Override
    public String toString() {
        return this.fullName;
    }

    public void findMinMaxLottoNumber(String stateName) {
        int currentMin = Integer.MAX_VALUE;
        int currentMax = Integer.MIN_VALUE;

        for (LotteryDraw lotteryDraw : lotteryDraws) {
            for (int winningNumber : lotteryDraw.getDrawResults()) {
                currentMin = Math.min(currentMin, winningNumber);
                currentMax = Math.max(currentMax, winningNumber);
            }
        }

        maxNumber = currentMax;
        minNumber = currentMin;

        if (fullName.equals("Cash Five") && "Texas".equals(stateName)) {
            maxNumber = 35;
        }
        else if (fullName.equals("Mega Millions")) {
            maxNumber = 70;
        }
        if (fullName.equals("Easy 5")) {
            maxNumber = 37;
        }
    }

    public void sortByDrawDateDescending() {
        lotteryDraws.sort((Comparator.comparing(LotteryDraw::getDrawDate)));
    }
}
