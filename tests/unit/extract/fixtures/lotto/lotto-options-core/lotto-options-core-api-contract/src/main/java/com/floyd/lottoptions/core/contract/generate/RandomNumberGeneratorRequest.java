package com.floyd.lottoptions.core.contract.generate;

/**
 * Request body of {@code POST /api/v1/analysis/generate/numbers}: which tickets to generate. The
 * BFF and the Desktop client send it.
 *
 * <p>A record's arrays compare by identity, so two requests with equal {@code allowedGroups} are
 * not {@code equals}.</p>
 *
 * @param lotteryState              the state's name (for example "Texas")
 * @param lotteryGame               the game's full name (for example "Cash Five")
 * @param numberGenerator           the generation strategy, for example
 *                                  {@code LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN} or
 *                                  {@code SecureRandom}; Core answers 400 for a value it does not
 *                                  know
 * @param numberSetsPerPattern      the tickets per hot spread for Balanced Spread, the tickets in
 *                                  all for the other strategies
 * @param targetedPrizeLevel        the prize level the tickets should be due for: its correct
 *                                  numbers
 * @param drawDaysPerWeek           the game's drawings per week
 * @param templateSelectionStrategy how {@code TEMPLATE_MATRIX} selects its templates; absent, or a
 *                                  value Core does not know, means its default
 * @param allowedGroups             not read by Core
 */
public record RandomNumberGeneratorRequest(String lotteryState, String lotteryGame, String numberGenerator,
                                           int numberSetsPerPattern, int targetedPrizeLevel, int drawDaysPerWeek,
                                           String templateSelectionStrategy, String[] allowedGroups) {}
