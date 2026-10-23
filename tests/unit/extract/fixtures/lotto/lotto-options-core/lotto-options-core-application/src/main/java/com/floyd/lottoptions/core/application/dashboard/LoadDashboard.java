package com.floyd.lottoptions.core.application.dashboard;

import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.draw.DrawHistorySource;
import com.floyd.lottoptions.core.domain.draw.DrawHistoryUnavailableException;
import com.floyd.lottoptions.core.domain.draw.UnknownGameException;
import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.core.domain.gamesout.GamesOut;
import com.floyd.lottoptions.core.domain.pattern.PatternAnalyzer;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Use case: load a game's dashboard, over its full draw history, oldest draw first.
 */
public final class LoadDashboard {

    private final DrawHistorySource drawHistorySource;

    /**
     * @param drawHistorySource where draw histories are read from
     */
    public LoadDashboard(DrawHistorySource drawHistorySource) {
        this.drawHistorySource = Objects.requireNonNull(drawHistorySource, "drawHistorySource");
    }

    /**
     * Loads a game's dashboard.
     *
     * @param game the game
     * @return the dashboard, or empty when the source answered without the game or the game has
     *         no draws
     * @throws UnknownGameException           if the source has no such game in the state
     * @throws DrawHistoryUnavailableException if the source is down or failing
     */
    public Optional<Dashboard> load(GameId game) {
        return drawHistorySource.load(game)
                .filter(history -> !history.isEmpty())
                .map(LoadDashboard::dashboardOf);
    }

    private static Dashboard dashboardOf(DrawHistory history) {
        Game game = history.game();
        List<Draw> oldestFirst = history.oldestFirst();
        return new Dashboard(
                game,
                GamesOut.afterEachDraw(history),
                PatternAnalyzer.oddEven(game).analyze(oldestFirst),
                PatternAnalyzer.highLow(game).analyze(oldestFirst),
                oldestFirst.get(0).date(),
                oldestFirst.get(oldestFirst.size() - 1).date(),
                oldestFirst.size());
    }
}
