package com.floyd.lottoptions.core.contract.generate;

import java.util.List;

/**
 * Response body of {@code POST /api/v1/analysis/generate/numbers}: the generated tickets and how
 * they would have fared over the game's draw history.
 *
 * @param generatedNumbers                             the tickets, one array of numbers each
 * @param prizeLevelResults                            every prize level, from 0 correct numbers up
 * @param totalTickets                                 the number of tickets
 * @param estimatedElapsedDaysForTargetedPrizeLevelWin the expected days before the tickets win the
 *                                                     targeted prize level, at most the number of
 *                                                     draws in the history
 */
public record GeneratedNumberData(List<int[]> generatedNumbers, List<PrizeLevelResult> prizeLevelResults,
                                  int totalTickets, double estimatedElapsedDaysForTargetedPrizeLevelWin) {}
