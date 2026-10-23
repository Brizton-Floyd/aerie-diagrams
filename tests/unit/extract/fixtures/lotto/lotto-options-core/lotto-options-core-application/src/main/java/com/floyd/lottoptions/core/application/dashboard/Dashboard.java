package com.floyd.lottoptions.core.application.dashboard;

import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.gamesout.DrawGamesOut;
import com.floyd.lottoptions.core.domain.pattern.PatternStatistics;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * A game's dashboard: its games out after every draw and its odd/even and high/low patterns,
 * over the whole draw history.
 *
 * @param game            the game
 * @param gamesOut        the games out after each draw, oldest draw first
 * @param oddEvenPatterns the recent odd/even patterns, the most expected first
 * @param highLowPatterns the recent high/low patterns, the most expected first
 * @param firstDrawDate   the date of the oldest draw
 * @param lastDrawDate    the date of the latest draw
 * @param totalDraws      the draws in the history
 */
public record Dashboard(Game game, List<DrawGamesOut> gamesOut, List<PatternStatistics> oddEvenPatterns,
                        List<PatternStatistics> highLowPatterns, LocalDate firstDrawDate,
                        LocalDate lastDrawDate, int totalDraws) {

    public Dashboard {
        Objects.requireNonNull(game, "game");
        Objects.requireNonNull(firstDrawDate, "firstDrawDate");
        Objects.requireNonNull(lastDrawDate, "lastDrawDate");
        gamesOut = List.copyOf(gamesOut);
        oddEvenPatterns = List.copyOf(oddEvenPatterns);
        highLowPatterns = List.copyOf(highLowPatterns);
    }
}
