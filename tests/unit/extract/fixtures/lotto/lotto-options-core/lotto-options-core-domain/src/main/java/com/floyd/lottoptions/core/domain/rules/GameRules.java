package com.floyd.lottoptions.core.domain.rules;

import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.gamesout.DrawGamesOut;
import com.floyd.lottoptions.core.domain.gamesout.NumberGamesOut;

import java.util.List;
import java.util.Objects;

/**
 * A game's rules as the dashboard screens read them: the field they lay out and the numbers a
 * draw hits.
 *
 * <p>The field and pick count are read off the games out after the latest draw, exactly as the
 * BFF read them before Core owned them (#46). For a pick-k game they equal the game's own
 * {@link Game#field() field} and {@link Game#pickCount() pick count}. For a digit game they do
 * not: the field is the encoded 0-39 of {@link com.floyd.lottoptions.core.domain.gamesout.GamesOut}
 * and the pick count is the game's positions. That difference is kept on purpose.</p>
 *
 * @param fieldMin  the smallest number of the latest draw's games out; {@code 1} when it has none
 * @param fieldMax  the largest number of the latest draw's games out; {@code 35} when it has none
 * @param pickCount the numbers the latest draw hit (its games out of {@code 0}); {@code 0} when
 *                  there is no draw
 * @param format    the game's pick count and the largest number of its field, as
 *                  {@code pickCount/max} (for example {@code 5/35})
 */
public record GameRules(int fieldMin, int fieldMax, int pickCount, String format) {

    /** The field's ends when the latest draw's games out list no number. */
    private static final int DEFAULT_FIELD_MIN = 1;
    private static final int DEFAULT_FIELD_MAX = 35;

    public GameRules {
        Objects.requireNonNull(format, "format");
    }

    /**
     * Derives a game's rules from its games out.
     *
     * @param game     the game
     * @param gamesOut the games out after each draw, oldest draw first
     * @return the game's rules
     */
    public static GameRules of(Game game, List<DrawGamesOut> gamesOut) {
        List<NumberGamesOut> latest = gamesOut.isEmpty() ? List.of() : gamesOut.get(gamesOut.size() - 1).numbers();
        return new GameRules(
                latest.stream().mapToInt(NumberGamesOut::number).min().orElse(DEFAULT_FIELD_MIN),
                latest.stream().mapToInt(NumberGamesOut::number).max().orElse(DEFAULT_FIELD_MAX),
                (int) latest.stream().filter(number -> number.gamesOut() == 0).count(),
                formatOf(game));
    }

    /**
     * @param game the game
     * @return the game's pick count and the largest number of its field, as {@code pickCount/max}
     */
    public static String formatOf(Game game) {
        return game.pickCount() + "/" + game.field().max();
    }
}
