package com.floyd.lottoptions.core.domain.pattern;

import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.game.Game;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Splits each draw's numbers into two groups, names the split as a pattern (for example
 * {@code 3 Odd 2 Even}), and reports how each pattern fared over a draw history.
 *
 * <p>The report keeps only the patterns seen recently enough, most expected first. Patterns
 * expected equally often keep the iteration order of a {@link HashMap} keyed by the pattern;
 * the dashboard goldens pin that order.</p>
 */
public abstract sealed class PatternAnalyzer permits OddEvenPatternAnalyzer, HighLowPatternAnalyzer {

    private static final int DECIMALS = 3;

    private final Game game;
    private final ProbabilityCalculator probabilityCalculator;

    /**
     * @param game                  the game whose draws are analyzed
     * @param probabilityCalculator how a pattern's probability is calculated
     */
    protected PatternAnalyzer(Game game, ProbabilityCalculator probabilityCalculator) {
        this.game = Objects.requireNonNull(game, "game");
        this.probabilityCalculator = Objects.requireNonNull(probabilityCalculator, "probabilityCalculator");
    }

    /**
     * The odd/even analyzer for a game, with the game's probability calculator.
     *
     * @param game the game
     * @return the analyzer
     */
    public static PatternAnalyzer oddEven(Game game) {
        return new OddEvenPatternAnalyzer(game, ProbabilityCalculator.forGame(game));
    }

    /**
     * The high/low analyzer for a game, with the game's probability calculator.
     *
     * @param game the game
     * @return the analyzer
     */
    public static PatternAnalyzer highLow(Game game) {
        return new HighLowPatternAnalyzer(game, ProbabilityCalculator.forGame(game));
    }

    /**
     * Analyzes a draw history.
     *
     * @param oldestFirst the game's draws, oldest first; the last one is the latest draw
     * @return the recent patterns, the most expected first
     */
    public final List<PatternStatistics> analyze(List<Draw> oldestFirst) {
        int totalDraws = oldestFirst.size();
        Map<String, Integer> frequency = new HashMap<>();
        Map<String, Integer> lastAppearance = new HashMap<>();
        Map<String, Split> splits = new HashMap<>();
        for (int i = 0; i < totalDraws; i++) {
            Split split = split(oldestFirst.get(i).numbers());
            String pattern = name(split);
            // Not merge(): for a new key in a used bucket it links the key first, put() links it last,
            // and that order breaks the ties of the report.
            frequency.put(pattern, frequency.getOrDefault(pattern, 0) + 1);
            lastAppearance.put(pattern, i);
            splits.putIfAbsent(pattern, split);
        }

        Split field = fieldSplit();
        List<PatternStatistics> recent = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : frequency.entrySet()) {
            String pattern = entry.getKey();
            double probability = probabilityCalculator.probability(splits.get(pattern), field, game);
            double estimatedHitFrequency = probability * totalDraws;
            int gamesSinceLastAppearance = totalDraws - lastAppearance.get(pattern) - 1;
            if (isRecent(gamesSinceLastAppearance)) {
                recent.add(new PatternStatistics(pattern, entry.getValue(), rounded(probability),
                        rounded(estimatedHitFrequency), gamesSinceLastAppearance));
            }
        }
        recent.sort(Comparator.comparingDouble(PatternStatistics::estimatedHitFrequency).reversed());
        return recent;
    }

    /**
     * @param number a drawn number, or a number of the field
     * @return whether it falls into the first group (odd, or low)
     */
    protected abstract boolean inFirstGroup(int number);

    /**
     * @param split a draw's split
     * @return the pattern's name, for example {@code 3 Odd 2 Even}
     */
    protected abstract String name(Split split);

    /**
     * @param gamesSinceLastAppearance the draws since the pattern last showed
     * @return whether the pattern showed recently enough to be reported
     */
    protected abstract boolean isRecent(int gamesSinceLastAppearance);

    private Split split(List<Integer> numbers) {
        int first = 0;
        int second = 0;
        for (int number : numbers) {
            if (inFirstGroup(number)) {
                first++;
            } else {
                second++;
            }
        }
        return new Split(first, second);
    }

    private Split fieldSplit() {
        int first = 0;
        int second = 0;
        for (int number = game.field().min(); number <= game.field().max(); number++) {
            if (inFirstGroup(number)) {
                first++;
            } else {
                second++;
            }
        }
        return new Split(first, second);
    }

    private static double rounded(double value) {
        return new BigDecimal(value).setScale(DECIMALS, RoundingMode.HALF_UP).doubleValue();
    }
}
