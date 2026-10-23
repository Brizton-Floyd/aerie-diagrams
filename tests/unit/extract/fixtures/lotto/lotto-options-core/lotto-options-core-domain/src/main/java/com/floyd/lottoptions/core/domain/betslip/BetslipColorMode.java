package com.floyd.lottoptions.core.domain.betslip;

/**
 * How a betslip is printed.
 */
public enum BetslipColorMode {

    /** The slip image as scanned, in color. */
    COLOR,

    /** The slip in grayscale. */
    BLACK_AND_WHITE,

    /** For the lottery's scanner; printed in grayscale, the same as {@link #BLACK_AND_WHITE}. */
    SCANNER_READY
}
