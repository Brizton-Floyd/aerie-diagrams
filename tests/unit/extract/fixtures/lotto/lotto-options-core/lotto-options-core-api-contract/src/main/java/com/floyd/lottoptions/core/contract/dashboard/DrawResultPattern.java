package com.floyd.lottoptions.core.contract.dashboard;

import java.util.List;

/**
 * The games out of every number of the field right after one draw. A digit game's numbers are
 * encoded by position, 0-39: the digit {@code d} at position {@code i} is {@code d + 10 * i}.
 *
 * @param drawDate       the draw's date, as {@code yyyy-MM-dd}
 * @param lotteryNumbers every number of the field with its games out, smallest number first
 */
public record DrawResultPattern(String drawDate, List<LotteryNumber> lotteryNumbers) {}
