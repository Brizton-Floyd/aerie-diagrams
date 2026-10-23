package com.floyd.lottoptions.core.application.generate;

import com.floyd.lottoptions.core.application.generate.GeneratedTickets.PrizeLevelOutcome;
import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.draw.DrawHistorySource;
import com.floyd.lottoptions.core.domain.draw.DrawHistoryUnavailableException;
import com.floyd.lottoptions.core.domain.draw.UnknownGameException;
import com.floyd.lottoptions.core.domain.game.Game;
import com.floyd.lottoptions.core.domain.generate.LotteryCalculator;
import com.floyd.lottoptions.core.domain.generate.LotteryResultsComparator;
import com.floyd.lottoptions.core.domain.generate.PrizeLevel;
import com.floyd.lottoptions.core.domain.generate.TicketGenerator;

import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.concurrent.CancellationException;

/**
 * Use case: generate tickets for a game by a generation strategy, and back-test them over the
 * game's draw history, oldest draw first.
 *
 * <p>The back-test regenerates tickets until the targeted prize level has been out for its
 * expected number of draws, within {@link SearchLimits}: when the limits are reached first, the
 * result carries the generated tickets whose targeted prize level had been out the longest.
 * Interrupting the calling thread stops the search with a {@link CancellationException}.</p>
 */
public final class GenerateNumbers {

    private static final Logger log = System.getLogger(GenerateNumbers.class.getName());

    private final DrawHistorySource drawHistorySource;
    private final TicketGeneratorFactory generators;
    private final SearchLimits searchLimits;

    /**
     * @param drawHistorySource where draw histories are read from
     * @param generators        builds each strategy's ticket generator
     * @param searchLimits      how long a request may search for tickets that meet the targeted
     *                          prize level
     */
    public GenerateNumbers(DrawHistorySource drawHistorySource, TicketGeneratorFactory generators,
                           SearchLimits searchLimits) {
        this.drawHistorySource = Objects.requireNonNull(drawHistorySource, "drawHistorySource");
        this.generators = Objects.requireNonNull(generators, "generators");
        this.searchLimits = Objects.requireNonNull(searchLimits, "searchLimits");
    }

    /**
     * Generates and back-tests the request's tickets, or the closest ones found within the
     * {@link SearchLimits}.
     *
     * @param request what to generate
     * @return the tickets, or empty when the source answered without the game
     * @throws UnknownGameException            if the source has no such game in the state
     * @throws DrawHistoryUnavailableException if the source is down or failing
     * @throws IllegalArgumentException        if Secure Random or Fast Random cannot draw that many
     *                                         distinct tickets for the game
     * @throws CancellationException           if the calling thread is interrupted while generating
     */
    public Optional<GeneratedTickets> generate(GenerationRequest request) {
        return drawHistorySource.load(request.game()).map(history -> generate(request, history));
    }

    private GeneratedTickets generate(GenerationRequest request, DrawHistory history) {
        Game game = history.game();
        int maxNumber = game.field().max();
        int pickCount = game.pickCount();
        TicketGenerator generator = generators.create(request.strategy(), history,
                request.numberSetsPerPattern(), request.templateSelectionStrategy());

        List<int[]> generatedNumbers = generator.generate();

        double expectedDaysBeforeWinning = LotteryCalculator.calculateExpectedDaysToWin(
                maxNumber, pickCount, generatedNumbers.size(), request.targetedPrizeLevel(),
                request.drawDaysPerWeek());
        // Games out counts draws, so the search compares it with the expected wait in draws, not in days.
        double expectedDrawsBeforeWinning = LotteryCalculator.calculateExpectedDrawingsToWin(
                maxNumber, pickCount, generatedNumbers.size(), request.targetedPrizeLevel());

        List<Draw> draws = history.oldestFirst();
        LotteryResultsComparator comparator = new LotteryResultsComparator(draws);

        int maxHistoricalDays = draws.size();
        if (expectedDaysBeforeWinning > maxHistoricalDays) {
            expectedDaysBeforeWinning = maxHistoricalDays;
            log.log(Level.WARNING,
                    "Expected days before winning exceeds available historical data. Adjusting to maximum available.");
        }

        long deadline = System.nanoTime() + searchLimits.deadline().toNanos();
        long comparisons = 0;
        Candidate best = null;
        for (int generations = 1; ; generations++) {
            List<PrizeLevel> prizeLevels = comparator.compare(generatedNumbers);
            comparisons += (long) generatedNumbers.size() * draws.size();
            int targetedGamesOut = targetedGamesOut(prizeLevels, request.targetedPrizeLevel()).orElse(-1);

            if (best == null || targetedGamesOut > best.targetedGamesOut()) {
                best = new Candidate(List.copyOf(generatedNumbers), prizeLevels, targetedGamesOut);
            }
            if (targetedGamesOut >= expectedDrawsBeforeWinning || targetedGamesOut >= maxHistoricalDays) {
                break;
            }
            if (comparisons >= searchLimits.maxComparisons()) {
                log.log(Level.INFO, "No tickets met prize level {0} within {1} generations; "
                        + "returning the closest ({2} games out)",
                        request.targetedPrizeLevel(), generations, best.targetedGamesOut());
                break;
            }
            if (System.nanoTime() - deadline >= 0) {
                log.log(Level.WARNING, "No tickets met prize level {0} within {1}; "
                        + "returning the closest ({2} games out) after {3} generations",
                        request.targetedPrizeLevel(), searchLimits.deadline(), best.targetedGamesOut(), generations);
                break;
            }
            if (Thread.currentThread().isInterrupted()) {
                throw new CancellationException("Number generation was interrupted");
            }
            generatedNumbers = generator.generate();
        }

        int tickets = best.tickets().size();
        List<PrizeLevelOutcome> outcomes = best.prizeLevels().stream()
                .map(level -> new PrizeLevelOutcome(level.correctNumbers(), level.hits(), level.gamesOut(),
                        roundToCents(LotteryCalculator.calculateExpectedDaysToWin(maxNumber, pickCount, tickets,
                                level.correctNumbers(), request.drawDaysPerWeek()))))
                .toList();
        return new GeneratedTickets(best.tickets(), outcomes, expectedDaysBeforeWinning);
    }

    /** Rounds to two decimal places. */
    private static double roundToCents(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    /**
     * Finds how many games the targeted prize level has been out.
     *
     * @return the targeted level's games out, or empty if the game has no such level
     */
    private static OptionalInt targetedGamesOut(List<PrizeLevel> prizeLevels, int targetedPrizeLevel) {
        return prizeLevels.stream()
                .filter(prizeLevel -> prizeLevel.correctNumbers() == targetedPrizeLevel)
                .mapToInt(PrizeLevel::gamesOut)
                .findFirst();
    }

    /**
     * How long one request may regenerate tickets looking for a set whose targeted prize level has
     * been out for its expected number of draws.
     *
     * <p>The deterministic limit counts back-test work, not generations: each generation compares
     * every ticket with every historical draw, and that is where its time goes, so a generation of
     * 200 tickets weighs as much as 33 generations of 6. The search stops after the generation
     * that reaches the limit, so the outcome depends only on the request and the draw history.</p>
     *
     * @param maxComparisons the ticket-to-draw comparisons a request may spend back-testing
     * @param deadline       a wall-clock backstop for slow machines, well under Core's 30 s async
     *                       request timeout
     */
    public record SearchLimits(long maxComparisons, Duration deadline) {

        /**
         * The production limits. 25 million comparisons take about 2-3 s on a developer laptop
         * for every snapshot game and strategy, at the Web UI's defaults and at its maximum of 12
         * sets.
         */
        public static final SearchLimits DEFAULT = new SearchLimits(25_000_000L, Duration.ofSeconds(20));

        public SearchLimits {
            if (maxComparisons < 1) {
                throw new IllegalArgumentException("maxComparisons must be at least 1: " + maxComparisons);
            }
            Objects.requireNonNull(deadline, "deadline");
        }
    }

    /** A back-tested ticket set: its tickets, its prize levels and how long its targeted level had been out. */
    private record Candidate(List<int[]> tickets, List<PrizeLevel> prizeLevels, int targetedGamesOut) {
    }
}
