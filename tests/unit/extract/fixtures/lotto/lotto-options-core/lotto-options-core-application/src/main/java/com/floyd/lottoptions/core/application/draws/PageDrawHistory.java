package com.floyd.lottoptions.core.application.draws;

import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.draw.DrawHistorySource;
import com.floyd.lottoptions.core.domain.draw.DrawHistoryUnavailableException;
import com.floyd.lottoptions.core.domain.draw.UnknownGameException;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.core.domain.gamesout.DrawGamesOut;
import com.floyd.lottoptions.core.domain.gamesout.GamesOut;
import com.floyd.lottoptions.core.domain.rules.GameRules;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;

/**
 * Use case: read one page of a game's draw history, each draw with the games out after it, so a
 * screen never needs the whole history.
 *
 * <p>The games out are counted over the whole history, so a page's draws carry the same values
 * they have in the full dashboard. Indexes count the draws oldest first, from {@code 0}; a page
 * holds up to {@code size} draws ending just before {@code endIndex}.</p>
 */
public final class PageDrawHistory {

    /** The most draws one page holds. */
    public static final int MAX_PAGE_SIZE = 100;

    private final DrawHistorySource drawHistorySource;

    /**
     * @param drawHistorySource where draw histories are read from
     */
    public PageDrawHistory(DrawHistorySource drawHistorySource) {
        this.drawHistorySource = Objects.requireNonNull(drawHistorySource, "drawHistorySource");
    }

    /**
     * Reads one page of a game's draw history.
     *
     * @param game     the game
     * @param endIndex the index just past the page's latest draw, at least {@code 0}; past the
     *                 history it means the history's end, and empty means the latest page
     * @param size     the most draws the page holds, from {@code 1} to {@link #MAX_PAGE_SIZE}
     * @return the page, or empty when the source answered without the game or the game has no
     *         draws
     * @throws IllegalArgumentException        if {@code endIndex} or {@code size} is out of range
     * @throws UnknownGameException            if the source has no such game in the state
     * @throws DrawHistoryUnavailableException if the source is down or failing
     */
    public Optional<DrawHistoryPage> page(GameId game, OptionalInt endIndex, int size) {
        if (endIndex.isPresent() && endIndex.getAsInt() < 0) {
            throw new IllegalArgumentException("endIndex must be >= 0, got: " + endIndex.getAsInt());
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be in [1.." + MAX_PAGE_SIZE + "], got: " + size);
        }
        return drawHistorySource.load(game)
                .filter(history -> !history.isEmpty())
                .map(history -> pageOf(history, endIndex, size));
    }

    private static DrawHistoryPage pageOf(DrawHistory history, OptionalInt endIndex, int size) {
        List<DrawGamesOut> gamesOut = GamesOut.afterEachDraw(history);
        int total = gamesOut.size();
        int end = Math.min(endIndex.orElse(total), total);
        int start = Math.max(0, end - size);
        return new DrawHistoryPage(GameRules.of(history.game(), gamesOut), total, start, end,
                gamesOut.subList(start, end));
    }
}
