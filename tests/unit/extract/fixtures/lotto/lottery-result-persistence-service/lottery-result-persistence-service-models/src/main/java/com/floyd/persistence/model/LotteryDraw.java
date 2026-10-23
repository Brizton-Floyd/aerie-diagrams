package com.floyd.persistence.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LotteryDraw implements Serializable {
    /** Pinned implicit value; see {@link LotteryGame#serialVersionUID} for rationale. */
    private static final long serialVersionUID = -8462990218649296061L;

    private LocalDate drawDate;
    /** The separately drawn bonus ball (e.g. the Powerball or Mega Ball); null for games without one. */
    private Integer bonusNumber;
    /**
     * The drawn multiplier (e.g. Power Play or Megaplier), kept apart from {@link #bonusNumber}.
     * Null when the game has no multiplier or the source did not record one for this draw
     * (Mega Millions since 2025-04-08, Powerball 2012-01-18 to 2014-01-18). Adding this field
     * is backward compatible: the pinned {@link #serialVersionUID} lets older {@code .ser}
     * files deserialize with it null, and {@code NON_NULL} omits it from JSON when absent.
     */
    private Integer multiplier;
    private List<Integer> drawResults = new ArrayList<>();

    public LotteryDraw() {}
    public LotteryDraw(LotteryDraw lotteryDraw) {
        this.drawDate = lotteryDraw.getDrawDate();
        this.bonusNumber = lotteryDraw.getBonusNumber();
        this.multiplier = lotteryDraw.getMultiplier();
        populateDrawResults(lotteryDraw.getDrawResults());
    }

    private void populateDrawResults(List<Integer> drawResults) {
        for (int i = 0; i < drawResults.size(); i++) {
            this.drawResults.add(drawResults.get(i));
        }
    }
}
