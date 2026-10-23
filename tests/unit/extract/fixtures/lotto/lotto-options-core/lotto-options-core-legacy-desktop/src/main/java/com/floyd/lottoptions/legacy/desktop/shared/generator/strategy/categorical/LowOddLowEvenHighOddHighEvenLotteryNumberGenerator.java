package com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical;

import com.floyd.lottoptions.legacy.desktop.shared.generator.LotteryNumberGenerator;
import com.floyd.lottoptions.legacy.desktop.shared.generator.RandomSource;
import com.floyd.persistence.model.LotteryDraw;
import com.floyd.persistence.model.LotteryGame;

import java.util.*;
import java.util.concurrent.CancellationException;

/**
 * A lottery number generator that employs a categorical strategy based on the distribution of numbers across
 * four categories: low-odd, low-even, high-odd, and high-even. It analyzes historical draw data to identify
 * high-probability ("hot") patterns and generates new number sets that conform to these patterns.
 *
 * <p>A pattern that has fewer distinct number sets than requested (a digit game's narrow categories, for example)
 * yields every distinct set it has. Generation stops with a {@link CancellationException} when the calling thread
 * is interrupted.</p>
 */
public class LowOddLowEvenHighOddHighEvenLotteryNumberGenerator implements LotteryNumberGenerator {
    private final LotteryGame lotteryGame;
    private final List<int[]> generatedNumbers;
    private final int numberSetsPerPattern;
    private final List<Pattern> patterns;
    private final RandomSource randomSource;

    /**
     * Constructs a generator for a specific lottery game.
     *
     * @param lotteryGame          The lottery game for which to generate numbers.
     * @param numberSetsPerPattern The number of unique number sets to generate for each selected "hot" pattern.
     */
    public LowOddLowEvenHighOddHighEvenLotteryNumberGenerator(LotteryGame lotteryGame, int numberSetsPerPattern) {
        this(lotteryGame, numberSetsPerPattern, RandomSource.perCall());
    }

    /**
     * Constructs a generator for a specific lottery game that draws its randomness from the given source.
     *
     * @param lotteryGame          The lottery game for which to generate numbers.
     * @param numberSetsPerPattern The number of unique number sets to generate for each selected "hot" pattern.
     * @param randomSource         The source of {@link Random} instances; one is taken per generated sequence.
     */
    public LowOddLowEvenHighOddHighEvenLotteryNumberGenerator(LotteryGame lotteryGame, int numberSetsPerPattern,
                                                              RandomSource randomSource) {
        this.lotteryGame = lotteryGame;
        this.numberSetsPerPattern = numberSetsPerPattern;
        this.randomSource = Objects.requireNonNull(randomSource, "randomSource");
        this.generatedNumbers = new ArrayList<>();
        PatternGenerator patternGenerator = new PatternGenerator();
        patterns = patternGenerator.generatePatterns(this.lotteryGame.getMaxNumber(), this.lotteryGame.getDrawPositionCount());
    }

    @Override
    public List<int[]> getGeneratedNumbers() {
        return this.generatedNumbers;
    }

    /**
     * Executes the number generation process. This involves analyzing historical draws, identifying the most
     * probable ("hot") patterns, and generating new, unique number sequences based on those patterns.
     *
     * @throws CancellationException if the calling thread is interrupted while generating
     */
    @Override
    public void process() {
        generatedNumbers.clear();

        List<LotteryDraw> lotteryDraws = lotteryGame.getLotteryDraws();
        analyzeDraws(lotteryDraws);

        Map<String, List<Pattern>> stringListMap = groupPatternsIntoBuckets(3);
        List<Pattern> hotPatterns = stringListMap.get("Hot");

        if (hotPatterns != null) {
            for (Pattern pattern : hotPatterns) {
                int count = distinctSequenceCount(pattern, lotteryGame.getMaxNumber(), this.numberSetsPerPattern);
                List<int[]> randomNumbers = generateUniqueRandomSequences(pattern, lotteryGame.getMaxNumber(), count);
                this.generatedNumbers.addAll(randomNumbers);
            }
        }
    }

    /**
     * Analyzes the historical draws of the lottery game to update the statistics of each predefined pattern.
     *
     * @param draws The list of historical lottery draws.
     */
    private void analyzeDraws(List<LotteryDraw> draws) {
        DrawAnalyzer drawAnalyzer = new DrawAnalyzer();
        drawAnalyzer.analyzeDraws(draws, patterns);
    }

    /**
     * Generates a specified number of unique random number sequences that match a given pattern.
     *
     * @param pattern      The pattern to which the generated sequences must conform.
     * @param totalNumbers The maximum number in the lottery game's range.
     * @param count        The number of unique sequences to generate; at most the pattern's distinct sequences.
     * @return A list of unique integer arrays, each representing a lottery number sequence.
     * @throws CancellationException if the calling thread is interrupted while generating
     */
    private List<int[]> generateUniqueRandomSequences(Pattern pattern, int totalNumbers, int count) {
        List<int[]> sequences = new ArrayList<>();
        Set<String> uniqueSequences = new HashSet<>();

        while (sequences.size() < count) {
            if (Thread.currentThread().isInterrupted()) {
                throw new CancellationException("Number generation was interrupted");
            }
            int[] sequence = generateRandomSequence(pattern, totalNumbers);
            Arrays.sort(sequence);
            String sequenceString = Arrays.toString(sequence);

            if (uniqueSequences.add(sequenceString)) {
                sequences.add(sequence);
            }
        }
        return sequences;
    }

    /**
     * Counts the distinct number sequences that conform to the pattern, up to {@code limit}: the product, over the
     * four categories, of the ways to choose the pattern's count from the numbers in that category. The categories
     * are the ranges {@link #generateRandomSequence} draws from.
     *
     * @param pattern      The pattern whose sequences to count.
     * @param totalNumbers The maximum number in the lottery game's range.
     * @param limit        The count to stop at; nothing overflows on the way.
     * @return The number of distinct sequences, or {@code limit} if there are at least that many.
     */
    static int distinctSequenceCount(Pattern pattern, int totalNumbers, int limit) {
        int midpoint = pattern.getMidpoint();
        int[] categorySizes = {
                (midpoint + 1) / 2,                          // odd numbers in 1..midpoint
                midpoint / 2,                                // even numbers in 1..midpoint
                (totalNumbers + 1) / 2 - (midpoint + 1) / 2, // odd numbers in midpoint+1..totalNumbers
                totalNumbers / 2 - midpoint / 2};            // even numbers in midpoint+1..totalNumbers
        int[] picks = {pattern.getLowerOdd(), pattern.getLowerEven(), pattern.getUpperOdd(), pattern.getUpperEven()};

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
     * Generates a single random number sequence that conforms to the given pattern's categorical constraints.
     *
     * @param pattern      The pattern defining the number of low-odd, low-even, high-odd, and high-even numbers.
     * @param totalNumbers The maximum number in the lottery game's range.
     * @return An integer array representing a randomly generated lottery number sequence.
     */
    private int[] generateRandomSequence(Pattern pattern, int totalNumbers) {
        Random random = randomSource.next();
        int[] sequence = new int[pattern.getLowerOdd() + pattern.getLowerEven() + pattern.getUpperOdd() + pattern.getUpperEven()];
        Set<Integer> usedNumbers = new HashSet<>();
        int index = 0;

        for (int i = 0; i < pattern.getLowerOdd(); i++)
            sequence[index++] = generateUniqueRandomNumber(random, 1, pattern.getMidpoint(), true, usedNumbers);
        for (int i = 0; i < pattern.getLowerEven(); i++)
            sequence[index++] = generateUniqueRandomNumber(random, 1, pattern.getMidpoint(), false, usedNumbers);
        for (int i = 0; i < pattern.getUpperOdd(); i++)
            sequence[index++] = generateUniqueRandomNumber(random, pattern.getMidpoint() + 1, totalNumbers, true, usedNumbers);
        for (int i = 0; i < pattern.getUpperEven(); i++)
            sequence[index++] = generateUniqueRandomNumber(random, pattern.getMidpoint() + 1, totalNumbers, false, usedNumbers);

        return sequence;
    }

    /**
     * Generates a single unique random number within a specified range and parity (odd/even).
     *
     * @param random      The random number generator instance.
     * @param min         The minimum value of the range (inclusive).
     * @param max         The maximum value of the range (inclusive).
     * @param isOdd       True if an odd number is required, false for an even number.
     * @param usedNumbers A set of numbers already used in the current sequence to ensure uniqueness.
     * @return A unique random number conforming to the specified criteria.
     */
    private int generateUniqueRandomNumber(Random random, int min, int max, boolean isOdd, Set<Integer> usedNumbers) {
        int number;
        do {
            number = random.nextInt(max - min + 1) + min;
        } while ((number % 2 == 0) == isOdd || !usedNumbers.add(number));
        return number;
    }

    /**
     * Sorts all the generated patterns based on their theoretical probability in descending order.
     *
     * @return A list of patterns, sorted from most probable to least probable.
     */
    public List<Pattern> getSortedPatternsByProbability() {
        patterns.sort((o1, o2) -> o2.getProbability().compareTo(o1.getProbability()));
        return patterns;
    }

    /**
     * Groups the sorted patterns into a specified number of buckets (e.g., "Hot", "Warm", "Cold").
     * This allows for the selection of patterns based on their probability ranking.
     *
     * @param numberOfBuckets The number of buckets to partition the patterns into.
     * @return A map where keys are bucket names (e.g., "Hot") and values are lists of patterns belonging to that bucket.
     */
    public Map<String, List<Pattern>> groupPatternsIntoBuckets(int numberOfBuckets) {
        List<Pattern> sortedPatterns = getSortedPatternsByProbability();
        Map<String, List<Pattern>> buckets = new LinkedHashMap<>();
        int totalPatterns = sortedPatterns.size();
        int bucketSize = totalPatterns / numberOfBuckets;

        String[] bucketNames = {"Hot", "Warm", "Cold"};

        for (int i = 0; i < numberOfBuckets; i++) {
            String bucketName = (i < bucketNames.length) ? bucketNames[i] : "Bucket " + (i + 1);
            int start = i * bucketSize;
            int end = (i == numberOfBuckets - 1) ? totalPatterns : (i + 1) * bucketSize;
            buckets.put(bucketName, new ArrayList<>(sortedPatterns.subList(start, end)));
        }
        return buckets;
    }
}