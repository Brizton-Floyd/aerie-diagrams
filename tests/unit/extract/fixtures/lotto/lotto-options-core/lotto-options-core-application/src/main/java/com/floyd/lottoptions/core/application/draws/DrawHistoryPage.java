package com.floyd.lottoptions.core.application.draws;

import com.floyd.lottoptions.core.domain.gamesout.DrawGamesOut;
import com.floyd.lottoptions.core.domain.rules.GameRules;

import java.util.List;
import java.util.Objects;

/**
 * One page of a game's draw history: a run of consecutive draws, each with the games out after
 * it, and the game's rules.
 *
 * <p>Indexes count the draws oldest first, from {@code 0}.</p>
 *
 * @param rules      the game's rules, read off the whole history
 * @param totalDraws the draws in the whole history
 * @param startIndex the index of the page's oldest draw
 * @param endIndex   the index just past the page's latest draw
 * @param draws      the page's draws with their games out, oldest draw first
 */
public record DrawHistoryPage(GameRules rules, int totalDraws, int startIndex, int endIndex,
                              List<DrawGamesOut> draws) {

    public DrawHistoryPage {
        Objects.requireNonNull(rules, "rules");
        draws = List.copyOf(draws);
    }
}
