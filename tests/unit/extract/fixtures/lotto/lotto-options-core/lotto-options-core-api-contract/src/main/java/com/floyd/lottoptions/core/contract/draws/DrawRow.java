package com.floyd.lottoptions.core.contract.draws;

import java.util.List;

/**
 * One draw of a draw page: the games out of every number of the field right after the draw. A
 * digit game's numbers are encoded by position, 0-39: the digit {@code d} at position {@code i}
 * is {@code d + 10 * i}.
 *
 * @param drawDate the draw's date, as {@code yyyy-MM-dd}
 * @param numbers  every number of the field with its games out, smallest number first
 */
public record DrawRow(String drawDate, List<DrawRowNumber> numbers) {}
