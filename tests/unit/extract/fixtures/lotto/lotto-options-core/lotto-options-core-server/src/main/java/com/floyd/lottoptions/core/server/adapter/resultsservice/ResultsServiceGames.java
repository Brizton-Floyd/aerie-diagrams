package com.floyd.lottoptions.core.server.adapter.resultsservice;

import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.game.GameFormat;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.core.domain.game.NumberField;
import com.floyd.persistence.model.LotteryGame;

import java.util.Objects;

/**
 * Maps the results service's {@link LotteryGame} to Core's {@link Game}: the one place where a
 * game's {@link GameFormat} is derived.
 *
 * <p>A game whose field or pick count the results service does not know gets the field 1-1 and
 * the pick count 0.</p>
 */
final class ResultsServiceGames {

    /** A digit game draws from 0-9; every other game is pick-k. */
    private static final int DIGIT_GAME_MAX_NUMBER = 9;

    private static final int UNKNOWN_FIELD_END = 1;
    private static final int UNKNOWN_PICK_COUNT = 0;

    private ResultsServiceGames() {
    }

    static Game toGame(GameId id, LotteryGame game) {
        NumberField field = new NumberField(
                Objects.requireNonNullElse(game.getMinNumber(), UNKNOWN_FIELD_END),
                Objects.requireNonNullElse(game.getMaxNumber(), UNKNOWN_FIELD_END));
        int pickCount = Objects.requireNonNullElse(game.getDrawPositionCount(), UNKNOWN_PICK_COUNT);
        return new Game(id, formatOf(field), field, pickCount);
    }

    private static GameFormat formatOf(NumberField field) {
        return field.max() == DIGIT_GAME_MAX_NUMBER ? GameFormat.DIGIT : GameFormat.PICK_K;
    }
}
