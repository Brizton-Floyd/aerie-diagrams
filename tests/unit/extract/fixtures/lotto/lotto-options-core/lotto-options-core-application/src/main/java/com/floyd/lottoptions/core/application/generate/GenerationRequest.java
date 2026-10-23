package com.floyd.lottoptions.core.application.generate;

import com.floyd.lottoptions.core.domain.game.GameId;

import java.util.Objects;

/**
 * What a generate request asks for.
 *
 * @param game                      the game to generate tickets for
 * @param strategy                  the generation strategy
 * @param numberSetsPerPattern      the tickets per hot spread for Balanced Spread, the tickets in
 *                                  all for the other strategies
 * @param targetedPrizeLevel        the prize level the tickets should be due for: its correct
 *                                  numbers
 * @param drawDaysPerWeek           the game's drawings per week
 * @param templateSelectionStrategy how TEMPLATE_MATRIX selects its templates; {@code null} for
 *                                  its default, and ignored by the other strategies
 */
public record GenerationRequest(GameId game, GenerationStrategy strategy, int numberSetsPerPattern,
                                int targetedPrizeLevel, int drawDaysPerWeek, String templateSelectionStrategy) {

    public GenerationRequest {
        Objects.requireNonNull(game, "game");
        Objects.requireNonNull(strategy, "strategy");
    }
}
