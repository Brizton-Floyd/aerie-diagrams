package com.floyd.lottoptions.snapshot;

import java.util.List;

/**
 * The games the frozen fixtures cover, shared by the Core and BFF snapshot tests.
 */
public final class SnapshotGames {

    /** State every snapshot game belongs to, spelled as the catalog spells it. */
    public static final String STATE = "Texas";

    /** A game the results service does not have (its captured answer is a 404 ApiError). */
    public static final String MISSING_GAME = "No Such Game";

    /**
     * The six snapshot games, spanning Core's code paths: a 5-of-35 game, a 6-of-54 game whose
     * format changed, two bonus-ball games and two digit games.
     */
    public static final List<SnapshotGame> GAMES = List.of(
            new SnapshotGame("Cash Five", 5),
            new SnapshotGame("Lotto Texas", 6),
            new SnapshotGame("Powerball", 5),
            new SnapshotGame("Mega Millions", 5),
            new SnapshotGame("Pick 3 Day", 3),
            new SnapshotGame("Daily 4 Day", 4));

    private SnapshotGames() {
        throw new AssertionError("no instances");
    }

    /**
     * A snapshot game.
     *
     * @param name         the game name as the results service spells it
     * @param lastPosition the game's last draw position (its draw position count)
     */
    public record SnapshotGame(String name, int lastPosition) {

        /** The game's golden folder or file name. */
        public String slug() {
            return SnapshotFiles.slug(name);
        }

        @Override
        public String toString() {
            return name;
        }
    }
}
