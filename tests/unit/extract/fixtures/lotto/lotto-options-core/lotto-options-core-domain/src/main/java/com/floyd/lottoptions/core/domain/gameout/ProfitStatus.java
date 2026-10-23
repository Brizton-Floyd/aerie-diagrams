package com.floyd.lottoptions.core.domain.gameout;

import java.math.BigDecimal;

/**
 * Whether a period of play made or lost money.
 */
public enum ProfitStatus {
    GREEN,
    RED,
    BREAK_EVEN;

    /**
     * @param profit the period's winnings less its cost
     * @return {@link #GREEN} for a profit, {@link #RED} for a loss, {@link #BREAK_EVEN} for zero
     */
    public static ProfitStatus of(BigDecimal profit) {
        int sign = profit.compareTo(BigDecimal.ZERO);
        return sign > 0 ? GREEN : sign < 0 ? RED : BREAK_EVEN;
    }
}
