package com.floyd.lottoptions.core.domain.range;

/**
 * How often a range hits, against a fixed baseline: one draw in five.
 */
public enum RangeStatus {

    /** Hit in more than 1.2 times the baseline's share of draws. */
    HOT,

    /** Hit within 0.8 to 1.2 times the baseline's share of draws. */
    NORMAL,

    /** Hit in less than 0.8 times the baseline's share of draws. */
    COLD
}
