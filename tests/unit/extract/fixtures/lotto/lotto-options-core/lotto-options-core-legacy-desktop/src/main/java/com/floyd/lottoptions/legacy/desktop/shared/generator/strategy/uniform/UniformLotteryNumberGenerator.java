package com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.uniform;

import com.floyd.lottoptions.legacy.desktop.shared.generator.LotteryNumberGenerator;
import com.floyd.lottoptions.legacy.desktop.shared.generator.RandomSource;
import com.floyd.persistence.model.LotteryGame;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.stream.IntStream;

/**
 * A lottery number generator that makes uniform draws, without looking at the draw history: the
 * Secure Random and Fast Random generation strategies, which differ only in their {@link RandomSource}.
 *
 * <ul>
 *   <li>For a pick-k game, a ticket is k distinct numbers drawn uniformly from the game's field,
 *       sorted ascending.</li>
 *   <li>For a digit game (a field whose maximum is 9, such as Pick 3 or Daily 4), a ticket is k digits
 *       0-9 drawn independently, so digits can repeat; they stay in drawn order, one per position.</li>
 * </ul>
 *
 * <p>k is the game's draw position count. Each {@link #process()} replaces the tickets with the
 * requested number of new, mutually distinct tickets, all drawn from one {@code Random} of the source.</p>
 */
public class UniformLotteryNumberGenerator implements LotteryNumberGenerator {

    /** A game whose field ends at 9 is a digit game, the rule the rest of Core applies today. */
    private static final int DIGIT_GAME_MAX_NUMBER = 9;

    /** The digits 0-9 a digit-game position is drawn from. */
    private static final int DIGIT_COUNT = 10;

    /** The first number of a pick-k field when the game does not state it. */
    private static final int DEFAULT_MIN_NUMBER = 1;

    private final int numberOfTickets;
    private final int pickCount;
    private final boolean digitGame;
    private final int[] field;
    private final RandomSource randomSource;
    private final List<int[]> generatedNumbers;

    /**
     * Constructs a generator for a specific lottery game.
     *
     * @param lotteryGame     The lottery game for which to generate numbers; its max number and draw
     *                        position count must be set.
     * @param numberOfTickets The number of tickets each {@link #process()} generates.
     * @param randomSource    The source of {@link Random} instances; one is taken per {@link #process()}.
     * @throws IllegalArgumentException if the game cannot produce that many distinct tickets
     */
    public UniformLotteryNumberGenerator(LotteryGame lotteryGame, int numberOfTickets, RandomSource randomSource) {
        Objects.requireNonNull(lotteryGame, "lotteryGame");
        int maxNumber = Objects.requireNonNull(lotteryGame.getMaxNumber(), "lotteryGame.maxNumber");
        this.pickCount = Objects.requireNonNull(lotteryGame.getDrawPositionCount(), "lotteryGame.drawPositionCount");
        this.numberOfTickets = numberOfTickets;
        this.randomSource = Objects.requireNonNull(randomSource, "randomSource");
        this.digitGame = maxNumber == DIGIT_GAME_MAX_NUMBER;
        this.field = digitGame
                ? new int[0]
                : IntStream.rangeClosed(Objects.requireNonNullElse(lotteryGame.getMinNumber(), DEFAULT_MIN_NUMBER),
                        maxNumber).toArray();
        this.generatedNumbers = new ArrayList<>();

        if (!digitGame && pickCount > field.length) {
            throw new IllegalArgumentException("Cannot draw " + pickCount + " distinct numbers from a field of "
                    + field.length + " for " + lotteryGame.getFullName());
        }
        if (!hasAtLeastDistinctTickets(numberOfTickets)) {
            throw new IllegalArgumentException(lotteryGame.getFullName() + " has fewer than " + numberOfTickets
                    + " distinct tickets");
        }
    }

    @Override
    public List<int[]> getGeneratedNumbers() {
        return this.generatedNumbers;
    }

    /**
     * Replaces the generated tickets with new, mutually distinct uniform draws.
     */
    @Override
    public void process() {
        generatedNumbers.clear();

        Random random = randomSource.next();
        Set<List<Integer>> uniqueTickets = new HashSet<>();
        while (generatedNumbers.size() < numberOfTickets) {
            int[] ticket = digitGame ? drawDigits(random) : drawDistinctNumbers(random);
            if (uniqueTickets.add(Arrays.stream(ticket).boxed().toList())) {
                generatedNumbers.add(ticket);
            }
        }
    }

    /**
     * Draws one digit 0-9 per position, independently.
     */
    private int[] drawDigits(Random random) {
        int[] ticket = new int[pickCount];
        for (int position = 0; position < pickCount; position++) {
            ticket[position] = random.nextInt(DIGIT_COUNT);
        }
        return ticket;
    }

    /**
     * Draws k distinct numbers from the field with a partial Fisher-Yates shuffle, which makes every
     * k-subset equally likely, and sorts them ascending.
     */
    private int[] drawDistinctNumbers(Random random) {
        int[] shuffled = field.clone();
        for (int i = 0; i < pickCount; i++) {
            int j = i + random.nextInt(shuffled.length - i);
            int swapped = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = swapped;
        }
        int[] ticket = Arrays.copyOf(shuffled, pickCount);
        Arrays.sort(ticket);
        return ticket;
    }

    /**
     * Tells whether the game has at least {@code needed} distinct tickets: 10^k for a digit game,
     * C(n, k) for a pick-k game. Stops counting once {@code needed} is reached, so nothing overflows.
     */
    private boolean hasAtLeastDistinctTickets(int needed) {
        long count = 1;
        if (digitGame) {
            for (int position = 0; position < pickCount && count < needed; position++) {
                count *= DIGIT_COUNT;
            }
            return count >= needed;
        }
        // C(n, i) grows with i up to min(k, n - k), and C(n, k) = C(n, n - k).
        int n = field.length;
        int k = Math.min(pickCount, n - pickCount);
        for (int i = 0; i < k && count < needed; i++) {
            count = count * (n - i) / (i + 1);
        }
        return count >= needed;
    }
}
