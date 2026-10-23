package com.floyd.lottoptions.core.domain.gameout;

/**
 * How well a pool of numbers covered a game's draw history: the draws it fully trapped and the
 * near misses one or two numbers short of a full trap.
 *
 * @param totalDrawsAnalyzed the draws scanned
 * @param fullTraps          the draws whose numbers were all in the pool
 * @param minus1Traps        the draws one number short of a full trap
 * @param minus2Traps        the draws two numbers short of a full trap
 * @param fullTrapRate       {@code fullTraps} as a percentage of the draws, {@code 0} without draws
 * @param minus1TrapRate     {@code minus1Traps} as a percentage of the draws, {@code 0} without draws
 * @param minus2TrapRate     {@code minus2Traps} as a percentage of the draws, {@code 0} without draws
 */
public record CoverageAnalysis(
        int totalDrawsAnalyzed,
        int fullTraps,
        int minus1Traps,
        int minus2Traps,
        double fullTrapRate,
        double minus1TrapRate,
        double minus2TrapRate) {
}
