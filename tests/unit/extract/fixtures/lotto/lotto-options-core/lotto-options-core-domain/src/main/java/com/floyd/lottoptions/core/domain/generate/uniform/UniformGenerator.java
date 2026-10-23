package com.floyd.lottoptions.core.domain.generate.uniform;

import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.game.GameFormat;
import com.floyd.lottoptions.core.domain.generate.RandomSource;
import com.floyd.lottoptions.core.domain.generate.TicketGenerator;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.stream.IntStream;

/**
 * Uniform draws, without looking at the draw history: the Secure Random and Fast Random
 * generation strategies, which differ only in their {@link RandomSource}.
 *
 * <ul>
 *   <li>For a pick-k game, a ticket is k distinct numbers drawn uniformly from the game's field,
 *       sorted ascending.</li>
 *   <li>For a digit game, a ticket is k digits 0-9 drawn independently, so digits can repeat; they
 *       stay in drawn order, one per position.</li>
 * </ul>
 *
 * <p>k is the game's pick count. Each {@link #generate()} draws the requested number of mutually
 * distinct tickets, all from one {@code Random} of the source.</p>
 */
public final class UniformGenerator implements TicketGenerator {

    /** The digits 0-9 a digit-game position is drawn from. */
    private static final int DIGIT_COUNT = 10;

    private final int numberOfTickets;
    private final int pickCount;
    private final boolean digitGame;
    private final int[] field;
    private final RandomSource randomSource;

    /**
     * @param game            the game to draw tickets for
     * @param numberOfTickets the tickets each {@link #generate()} draws
     * @param randomSource    the source of {@link Random}s; one is taken per {@link #generate()}
     * @throws IllegalArgumentException if the game cannot produce that many distinct tickets
     */
    public UniformGenerator(Game game, int numberOfTickets, RandomSource randomSource) {
        Objects.requireNonNull(game, "game");
        this.pickCount = game.pickCount();
        this.numberOfTickets = numberOfTickets;
        this.randomSource = Objects.requireNonNull(randomSource, "randomSource");
        this.digitGame = game.format() == GameFormat.DIGIT;
        this.field = digitGame
                ? new int[0]
                : IntStream.rangeClosed(game.field().min(), game.field().max()).toArray();

        if (!digitGame && pickCount > field.length) {
            throw new IllegalArgumentException("Cannot draw " + pickCount + " distinct numbers from a field of "
                    + field.length + " for " + game.id().game());
        }
        if (!hasAtLeastDistinctTickets(numberOfTickets)) {
            throw new IllegalArgumentException(game.id().game() + " has fewer than " + numberOfTickets
                    + " distinct tickets");
        }
    }

    @Override
    public List<int[]> generate() {
        Random random = randomSource.next();
        List<int[]> tickets = new ArrayList<>();
        Set<List<Integer>> uniqueTickets = new HashSet<>();
        while (tickets.size() < numberOfTickets) {
            int[] ticket = digitGame ? drawDigits(random) : drawDistinctNumbers(random);
            if (uniqueTickets.add(Arrays.stream(ticket).boxed().toList())) {
                tickets.add(ticket);
            }
        }
        return tickets;
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
     * Draws k distinct numbers from the field with a partial Fisher-Yates shuffle, which makes
     * every k-subset equally likely, and sorts them ascending.
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
     * C(n, k) for a pick-k game. Stops counting once {@code needed} is reached, so nothing
     * overflows.
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
