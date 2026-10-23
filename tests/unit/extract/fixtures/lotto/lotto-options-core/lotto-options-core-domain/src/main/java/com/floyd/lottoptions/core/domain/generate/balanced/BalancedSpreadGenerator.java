package com.floyd.lottoptions.core.domain.generate.balanced;

import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.generate.RandomSource;
import com.floyd.lottoptions.core.domain.generate.TicketGenerator;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.CancellationException;

/**
 * The Balanced Spread generation strategy: tickets that fill the game's hot balanced spreads, the
 * most probable third of them.
 *
 * <p>Each call to {@link #generate()} first runs the draw history, oldest first, through
 * {@link DrawAnalyzer}, then draws {@code ticketsPerPattern} distinct tickets for every hot spread,
 * or every distinct ticket a spread has when it has fewer (a digit game's narrow categories, for
 * example). The spreads are ranked by theoretical probability alone. The field is
 * 1..{@code field().max()} and a ticket has the game's pick count of numbers.</p>
 */
public final class BalancedSpreadGenerator implements TicketGenerator {

    /** The spreads are ranked into hot, warm and cold thirds; only the hot one is played. */
    private static final int BUCKETS = 3;

    private final DrawHistory history;
    private final int maxNumber;
    private final int ticketsPerPattern;
    private final List<Pattern> patterns;
    private final RandomSource randomSource;

    /**
     * @param history           the game and its draws
     * @param ticketsPerPattern the distinct tickets to draw for each hot spread
     * @param randomSource      the source of {@link Random}s; one is taken per drawn ticket
     */
    public BalancedSpreadGenerator(DrawHistory history, int ticketsPerPattern, RandomSource randomSource) {
        this.history = Objects.requireNonNull(history, "history");
        this.maxNumber = history.game().field().max();
        this.ticketsPerPattern = ticketsPerPattern;
        this.randomSource = Objects.requireNonNull(randomSource, "randomSource");
        this.patterns = PatternGenerator.generatePatterns(maxNumber, history.game().pickCount());
    }

    /**
     * {@inheritDoc}
     *
     * @throws CancellationException if the calling thread is interrupted while generating
     */
    @Override
    public List<int[]> generate() {
        DrawAnalyzer.analyzeDraws(history.oldestFirst(), patterns);

        List<int[]> tickets = new ArrayList<>();
        for (Pattern pattern : hotPatterns()) {
            int count = distinctSequenceCount(pattern, maxNumber, ticketsPerPattern);
            tickets.addAll(generateUniqueRandomSequences(pattern, count));
        }
        return tickets;
    }

    /**
     * The most probable third of the spreads, most probable first.
     */
    List<Pattern> hotPatterns() {
        patterns.sort(PatternGenerator.MOST_PROBABLE_FIRST);
        return List.copyOf(patterns.subList(0, patterns.size() / BUCKETS));
    }

    /**
     * Draws {@code count} distinct tickets of the spread, each sorted ascending.
     *
     * @throws CancellationException if the calling thread is interrupted while generating
     */
    private List<int[]> generateUniqueRandomSequences(Pattern pattern, int count) {
        List<int[]> sequences = new ArrayList<>();
        Set<String> uniqueSequences = new HashSet<>();

        while (sequences.size() < count) {
            if (Thread.currentThread().isInterrupted()) {
                throw new CancellationException("Number generation was interrupted");
            }
            int[] sequence = generateRandomSequence(pattern);
            Arrays.sort(sequence);
            String sequenceString = Arrays.toString(sequence);

            if (uniqueSequences.add(sequenceString)) {
                sequences.add(sequence);
            }
        }
        return sequences;
    }

    /**
     * Counts the distinct tickets of the spread, up to {@code limit}: the product, over the four
     * categories, of the ways to choose the spread's count from the numbers in that category. The
     * categories are the ranges {@link #generateRandomSequence} draws from.
     *
     * @param pattern      the spread whose tickets to count
     * @param totalNumbers the field's largest number
     * @param limit        the count to stop at; nothing overflows on the way
     * @return the number of distinct tickets, or {@code limit} if there are at least that many
     */
    static int distinctSequenceCount(Pattern pattern, int totalNumbers, int limit) {
        int midpoint = pattern.midpoint();
        int[] categorySizes = {
                (midpoint + 1) / 2,                          // odd numbers in 1..midpoint
                midpoint / 2,                                // even numbers in 1..midpoint
                (totalNumbers + 1) / 2 - (midpoint + 1) / 2, // odd numbers in midpoint+1..totalNumbers
                totalNumbers / 2 - midpoint / 2};            // even numbers in midpoint+1..totalNumbers
        int[] picks = {pattern.lowerOdd(), pattern.lowerEven(), pattern.upperOdd(), pattern.upperEven()};

        long count = 1;
        for (int i = 0; i < categorySizes.length && count < limit; i++) {
            count = Math.min(limit, count * combinations(categorySizes[i], picks[i], limit));
        }
        return (int) Math.min(limit, count);
    }

    /**
     * Computes C(n, k), stopping at {@code limit}: C(n, i) grows with i up to min(k, n - k), and
     * C(n, k) = C(n, n - k), so once a partial value reaches the limit the result does too.
     */
    private static long combinations(int n, int k, int limit) {
        if (k < 0 || k > n) {
            return 0;
        }
        int smaller = Math.min(k, n - k);
        long count = 1;
        for (int i = 0; i < smaller && count < limit; i++) {
            count = count * (n - i) / (i + 1);
        }
        return Math.min(count, limit);
    }

    /**
     * Draws one ticket of the spread from the next {@link Random}: the low odd numbers first, then
     * the low even, the high odd and the high even ones.
     */
    private int[] generateRandomSequence(Pattern pattern) {
        Random random = randomSource.next();
        int[] sequence = new int[pattern.totalNumbers()];
        Set<Integer> usedNumbers = new HashSet<>();
        int index = 0;
        int midpoint = pattern.midpoint();

        for (int i = 0; i < pattern.lowerOdd(); i++) {
            sequence[index++] = generateUniqueRandomNumber(random, 1, midpoint, true, usedNumbers);
        }
        for (int i = 0; i < pattern.lowerEven(); i++) {
            sequence[index++] = generateUniqueRandomNumber(random, 1, midpoint, false, usedNumbers);
        }
        for (int i = 0; i < pattern.upperOdd(); i++) {
            sequence[index++] = generateUniqueRandomNumber(random, midpoint + 1, maxNumber, true, usedNumbers);
        }
        for (int i = 0; i < pattern.upperEven(); i++) {
            sequence[index++] = generateUniqueRandomNumber(random, midpoint + 1, maxNumber, false, usedNumbers);
        }
        return sequence;
    }

    /**
     * Draws a number of {@code min..max} with the given parity that the ticket does not hold yet.
     */
    private static int generateUniqueRandomNumber(Random random, int min, int max, boolean isOdd,
                                                  Set<Integer> usedNumbers) {
        int number;
        do {
            number = random.nextInt(max - min + 1) + min;
        } while ((number % 2 == 0) == isOdd || !usedNumbers.add(number));
        return number;
    }
}
