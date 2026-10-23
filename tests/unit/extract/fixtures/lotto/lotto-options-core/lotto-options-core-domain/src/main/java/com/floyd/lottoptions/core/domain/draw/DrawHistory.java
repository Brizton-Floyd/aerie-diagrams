package com.floyd.lottoptions.core.domain.draw;

import com.floyd.lottoptions.core.domain.game.Game;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * A game's draw history: every draw the source holds for the game.
 *
 * <p>The order is part of the type. However the source lists the draws, the history keeps them
 * oldest first, and draws on the same date keep the source's order. A use case states the order
 * it relies on by the accessor it reads.</p>
 *
 * @param game        the game the draws belong to
 * @param oldestFirst the draws, oldest first
 */
public record DrawHistory(Game game, List<Draw> oldestFirst) {

    private static final Comparator<Draw> BY_DATE = Comparator.comparing(Draw::date);

    public DrawHistory {
        Objects.requireNonNull(game, "game");
        List<Draw> sorted = new ArrayList<>(Objects.requireNonNull(oldestFirst, "oldestFirst"));
        sorted.sort(BY_DATE);
        oldestFirst = List.copyOf(sorted);
    }

    /**
     * @return {@code true} when the source holds no draw for the game
     */
    public boolean isEmpty() {
        return oldestFirst.isEmpty();
    }
}
