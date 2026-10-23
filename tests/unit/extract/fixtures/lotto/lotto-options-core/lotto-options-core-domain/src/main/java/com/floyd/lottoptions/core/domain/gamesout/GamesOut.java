package com.floyd.lottoptions.core.domain.gamesout;

import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.game.GameFormat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Games out per draw: for each draw of a history, how many draws each number of the field has
 * been out since it last hit.
 *
 * <p>Every number starts at {@code 0} before the first draw. A draw resets the numbers it hit to
 * {@code 0} and adds one to every other number.</p>
 *
 * <p>A digit game is encoded by position: the digit {@code d} drawn at position {@code i} (the
 * first position is {@code 0}) counts as the number {@code d + 10 * i}, so each position has its
 * own band of ten. The field is then 0-39, assuming 4 positions even for a 3-digit game, whose
 * band 30-39 never hits.</p>
 */
public final class GamesOut {

    /** A digit game's encoded field, 0-39: four positions of ten digits. */
    private static final int DIGIT_ENCODED_MIN = 0;
    private static final int DIGIT_ENCODED_MAX = 39;
    private static final int DIGITS_PER_POSITION = 10;

    private GamesOut() {
    }

    /**
     * Computes the games out after each draw of a history.
     *
     * @param history the game's draw history
     * @return one entry per draw, oldest draw first
     */
    public static List<DrawGamesOut> afterEachDraw(DrawHistory history) {
        Game game = history.game();
        boolean digitGame = game.format() == GameFormat.DIGIT;
        int min = digitGame ? DIGIT_ENCODED_MIN : game.field().min();
        int max = digitGame ? DIGIT_ENCODED_MAX : game.field().max();

        int[] gamesOut = new int[Math.max(0, max - min + 1)];
        List<DrawGamesOut> result = new ArrayList<>(history.oldestFirst().size());
        for (Draw draw : history.oldestFirst()) {
            Set<Integer> hits = digitGame ? positionEncoded(draw.numbers()) : new HashSet<>(draw.numbers());
            List<NumberGamesOut> numbers = new ArrayList<>(gamesOut.length);
            for (int i = 0; i < gamesOut.length; i++) {
                int number = min + i;
                gamesOut[i] = hits.contains(number) ? 0 : gamesOut[i] + 1;
                numbers.add(new NumberGamesOut(number, gamesOut[i]));
            }
            result.add(new DrawGamesOut(draw.date(), numbers));
        }
        return result;
    }

    private static Set<Integer> positionEncoded(List<Integer> digits) {
        Set<Integer> encoded = new HashSet<>();
        for (int position = 0; position < digits.size(); position++) {
            encoded.add(digits.get(position) + position * DIGITS_PER_POSITION);
        }
        return encoded;
    }
}
