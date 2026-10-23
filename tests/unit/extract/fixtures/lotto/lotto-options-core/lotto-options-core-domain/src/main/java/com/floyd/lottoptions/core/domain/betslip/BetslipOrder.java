package com.floyd.lottoptions.core.domain.betslip;

import com.floyd.lottoptions.core.domain.game.GameId;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * What to print on a game's betslips: the plays, one per play panel, filling as many slips as
 * they need.
 *
 * @param game         the game whose slips are printed
 * @param plays        the plays, in panel order; at least one
 * @param globalOption the global option the player asked for (for example {@code Cash}), as
 *                     given; empty or blank asks for the slip's default
 * @param colorMode    how the slips are printed
 */
public record BetslipOrder(GameId game, List<BetslipPlay> plays, Optional<String> globalOption,
                           BetslipColorMode colorMode) {

    public BetslipOrder {
        Objects.requireNonNull(game, "game");
        plays = List.copyOf(plays);
        if (plays.isEmpty()) {
            throw new IllegalArgumentException("A betslip order needs at least one play");
        }
        Objects.requireNonNull(globalOption, "globalOption");
        Objects.requireNonNull(colorMode, "colorMode");
    }
}
