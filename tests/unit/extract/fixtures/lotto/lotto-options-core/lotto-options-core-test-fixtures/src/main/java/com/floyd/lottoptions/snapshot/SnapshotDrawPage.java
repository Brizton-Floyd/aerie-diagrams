package com.floyd.lottoptions.snapshot;

import com.floyd.lottoptions.snapshot.SnapshotGames.SnapshotGame;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.ToIntFunction;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The pages of Core's draw history ({@code GET /api/v1/analysis/{state}/{game}/draws}) the
 * snapshots cover, shared by the Core and BFF snapshot tests (S33): the Core snapshots store one
 * golden per game and page, and the BFF's matrix snapshots are served from them, so each BFF
 * matrix page names the page it asks Core for.
 *
 * <p>Pages are set by {@code endIndex}, the index just past the page's latest draw (oldest
 * first, from {@code 0}; {@code -1} leaves it out, for the latest page), and {@code size}.</p>
 */
public enum SnapshotDrawPage {

    /** The latest 50 draws, the BFF's default page. */
    LATEST_50(game -> -1, 50),
    /** The latest 100 draws, the most one page holds. */
    LATEST_100(game -> -1, 100),
    /** The page ending at draw 50. */
    START(game -> 50, 50),
    /** The page ending in the middle of the history. */
    MIDDLE(game -> drawCount(game) / 2, 50),
    /** The page ending at the history's end, asked for by index. */
    END(SnapshotDrawPage::drawCount, 50);

    private static final Pattern TOTAL_DRAWS = Pattern.compile("\"totalDraws\":(\\d+)");
    private static final Map<String, Integer> DRAW_COUNTS = new ConcurrentHashMap<>();

    private final ToIntFunction<SnapshotGame> endIndex;
    private final int size;

    SnapshotDrawPage(ToIntFunction<SnapshotGame> endIndex, int size) {
        this.endIndex = endIndex;
        this.size = size;
    }

    /** The Core request's query, for example {@code ?endIndex=50&size=50}. */
    public String query(SnapshotGame game) {
        int end = endIndex.applyAsInt(game);
        return "?" + (end < 0 ? "" : "endIndex=" + end + "&") + "size=" + size;
    }

    /** The Core golden of this page for {@code game}, for example {@code draws/texas/cash-five/start}. */
    public String coreGolden(SnapshotGame game) {
        return "draws/texas/" + game.slug() + "/" + SnapshotFiles.slug(name());
    }

    /**
     * The number of draws in {@code game}'s history, the {@code totalDraws} of its Core dashboard
     * golden.
     */
    public static int drawCount(SnapshotGame game) {
        return DRAW_COUNTS.computeIfAbsent(game.name(), name -> {
            HttpSnapshot dashboard = SnapshotFiles.read(GoldenFiles.CORE_GOLDEN_ROOT, "dashboard/texas/" + game.slug())
                    .orElseThrow(() -> new IllegalStateException("No Core dashboard golden for " + name));
            Matcher totalDraws = TOTAL_DRAWS.matcher(new String(dashboard.body(), StandardCharsets.UTF_8));
            if (!totalDraws.find()) {
                throw new IllegalStateException("Core dashboard golden for " + name + " has no totalDraws");
            }
            return Integer.parseInt(totalDraws.group(1));
        });
    }
}
