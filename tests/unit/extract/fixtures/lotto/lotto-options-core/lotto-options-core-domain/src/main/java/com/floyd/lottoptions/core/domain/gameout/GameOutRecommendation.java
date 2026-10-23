package com.floyd.lottoptions.core.domain.gameout;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * One game's next-draw recommendation: PLAY when its game-out value is within the threshold,
 * SKIP otherwise.
 *
 * @param gameId                the game's full name
 * @param drawDate              the day after the latest draw
 * @param gameOutValue          the latest draw's game-out value
 * @param maxGameOut            the threshold it was held to
 * @param metadata              what the recommendation was trained on
 * @param historicalPerformance the replay of the requested years, or {@code null} when it was
 *                              not requested or no draw fell in them
 * @param decision              PLAY with what to play, or SKIP with why
 */
public record GameOutRecommendation(
        String gameId,
        LocalDate drawDate,
        int gameOutValue,
        int maxGameOut,
        Metadata metadata,
        HistoricalPerformance historicalPerformance,
        Decision decision) {

    public GameOutRecommendation {
        Objects.requireNonNull(gameId, "gameId");
        Objects.requireNonNull(metadata, "metadata");
        Objects.requireNonNull(decision, "decision");
    }

    /**
     * @return {@code true} for a PLAY decision
     */
    public boolean isPlay() {
        return !(decision instanceof Skip);
    }

    /**
     * @return the digit-game play, or empty for a SKIP or a large-pool play
     */
    public Optional<CombinationPlay> combinationPlay() {
        return decision instanceof CombinationPlay play ? Optional.of(play) : Optional.empty();
    }

    /**
     * What a recommendation was trained on.
     *
     * @param trainingDraws the draws in the history
     * @param lastDrawDate  the latest draw's date
     * @param hPoolSize     the requested hit-pool size
     * @param mPoolSize     the requested miss-pool size
     */
    public record Metadata(int trainingDraws, LocalDate lastDrawDate, Integer hPoolSize, Integer mPoolSize) {
    }

    /** The recommendation's outcome. */
    public sealed interface Decision permits Skip, CombinationPlay, PoolPlay {
    }

    /**
     * SKIP: the game-out value is above the threshold.
     *
     * @param reason why the game is skipped
     */
    public record Skip(String reason) implements Decision {
    }

    /**
     * PLAY for a digit game: every combination of the positional pools.
     *
     * @param betLevel     the stake per combination
     * @param prize        what one winning combination pays
     * @param pattern      the latest draw's positional pattern
     * @param pools        each position's pool, in pool order
     * @param combinations every combination of the pools
     * @param totalCost    {@code betLevel} times the combinations
     */
    public record CombinationPlay(
            BigDecimal betLevel,
            BigDecimal prize,
            String pattern,
            Map<String, Set<Integer>> pools,
            List<List<Integer>> combinations,
            BigDecimal totalCost) implements Decision {

        public CombinationPlay {
            pools = Collections.unmodifiableMap(new LinkedHashMap<>(pools));
            combinations = List.copyOf(combinations);
        }
    }

    /**
     * PLAY for a large-pool game: one whole-number pool to pick from.
     *
     * @param betLevel            the stake
     * @param pattern             the latest draw's last-digit pattern
     * @param poolNumbers         the pool, ascending
     * @param positionalBreakdown each position's share of the pool, ascending
     * @param coverageAnalysis    how the pool covered the history, or {@code null} when
     *                            historical performance was not requested
     */
    public record PoolPlay(
            BigDecimal betLevel,
            String pattern,
            List<Integer> poolNumbers,
            Map<String, List<Integer>> positionalBreakdown,
            CoverageAnalysis coverageAnalysis) implements Decision {

        public PoolPlay {
            poolNumbers = List.copyOf(poolNumbers);
            positionalBreakdown = Collections.unmodifiableMap(new LinkedHashMap<>(positionalBreakdown));
        }
    }
}
