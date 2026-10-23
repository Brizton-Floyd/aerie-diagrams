package com.floyd.lottoptions.legacy.desktop.grouping;

import com.floyd.lottoptions.legacy.desktop.shared.dashboard.PatternAnalyzer;
import com.floyd.lottoptions.legacy.desktop.shared.dashboard.ProbabilityCalculator;
import com.floyd.model.dashboard.PatternAnalysisResult;
import com.floyd.persistence.model.LotteryDraw;
import com.floyd.persistence.model.LotteryGame;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Analyzes lottery draw data to identify and quantify first-digit patterns.
 * This analyzer extracts the first digit of each number in a draw (0 for single-digit numbers)
 * and creates positional pattern strings like "01223", "01234", etc.
 * 
 * Excludes Pick 3/Pick 4 games (number range ≤ 9) from analysis.
 */
public class FirstDigitPatternAnalyzer implements PatternAnalyzer {

    private Map<String, PatternAnalysisResult> patternResults = new LinkedHashMap<>();
    private final ProbabilityCalculator probabilityCalculator;

    /**
     * Constructs a FirstDigitPatternAnalyzer with a specific probability calculation strategy.
     *
     * @param probabilityCalculator The strategy for calculating pattern probabilities.
     */
    public FirstDigitPatternAnalyzer(ProbabilityCalculator probabilityCalculator) {
        this.probabilityCalculator = probabilityCalculator;
    }

    @Override
    public void analyze(LotteryGame game) {
        // Skip Pick 3/Pick 4 games
        if (isPick3Or4Game(game)) {
            return;
        }

        int totalDraws = game.getLotteryDraws().size();
        Map<String, Integer> patternFrequency = new HashMap<>();
        Map<String, Integer> patternLastAppearance = new HashMap<>();

        for (int i = 0; i < totalDraws; i++) {
            LotteryDraw draw = game.getLotteryDraws().get(i);
            List<Integer> sortedNumbers = draw.getDrawResults().stream()
                    .sorted()
                    .collect(Collectors.toList());
            
            String pattern = extractFirstDigitPattern(sortedNumbers);
            patternFrequency.put(pattern, patternFrequency.getOrDefault(pattern, 0) + 1);
            patternLastAppearance.put(pattern, i);
        }

        buildPatternResults(patternFrequency, patternLastAppearance, totalDraws, game);
    }

    /**
     * Extracts the first-digit pattern from a sorted list of lottery numbers.
     * 
     * For example: [7, 14, 20, 22, 35] becomes:
     * - First digits: [0, 1, 2, 2, 3] (7→0, 14→1, 20→2, 22→2, 35→3)
     * - Unique sorted: [0, 1, 2, 3]
     * - Pattern: "01223"
     *
     * @param sortedNumbers The lottery numbers in ascending order
     * @return The first-digit positional pattern string
     */
    private String extractFirstDigitPattern(List<Integer> sortedNumbers) {
        // Extract first digits
        List<Integer> firstDigits = sortedNumbers.stream()
                .map(this::getFirstDigit)
                .collect(Collectors.toList());

        // Get unique digits and sort them
        List<Integer> uniqueDigits = firstDigits.stream()
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        // Build pattern string by mapping each digit to its position in unique sorted list
        StringBuilder pattern = new StringBuilder();
        for (Integer digit : firstDigits) {
            int position = uniqueDigits.indexOf(digit);
            pattern.append(position);
        }

        return pattern.toString();
    }

    /**
     * Gets the first digit of a number. Single-digit numbers return 0.
     *
     * @param number The lottery number
     * @return 0 for single-digit numbers, first digit for multi-digit numbers
     */
    private int getFirstDigit(int number) {
        if (number < 10) {
            return 0;
        }
        return Integer.parseInt(String.valueOf(number).substring(0, 1));
    }

    /**
     * Determines if this is a Pick 3 or Pick 4 game based on number range.
     *
     * @param game The lottery game to check
     * @return true if the game has a number range ≤ 9 (Pick 3/Pick 4)
     */
    private boolean isPick3Or4Game(LotteryGame game) {
        return game.getMaxNumber() <= 9;
    }

    /**
     * Builds the pattern analysis results from frequency data.
     *
     * @param patternFrequency Map of pattern strings to their frequencies
     * @param patternLastAppearance Map of pattern strings to their last appearance index
     * @param totalDraws Total number of draws analyzed
     * @param game The lottery game being analyzed
     */
    private void buildPatternResults(Map<String, Integer> patternFrequency,
                                   Map<String, Integer> patternLastAppearance,
                                   int totalDraws,
                                   LotteryGame game) {
        
        for (Map.Entry<String, Integer> entry : patternFrequency.entrySet()) {
            String pattern = entry.getKey();
            int frequency = entry.getValue();
            
            // Calculate probability using the provided strategy
            double probability = probabilityCalculator.calculate(pattern, 0, 0, game);
            double estimatedHitFrequency = probability * totalDraws;
            int gamesSinceLastAppearance = totalDraws - patternLastAppearance.get(pattern) - 1;

            // Round probability and estimated hit frequency
            BigDecimal bd = new BigDecimal(probability).setScale(3, RoundingMode.HALF_UP);
            probability = bd.doubleValue();

            bd = new BigDecimal(estimatedHitFrequency).setScale(3, RoundingMode.HALF_UP);
            estimatedHitFrequency = bd.doubleValue();

            patternResults.put(pattern, new PatternAnalysisResult(
                    pattern, 
                    frequency, 
                    probability, 
                    estimatedHitFrequency, 
                    gamesSinceLastAppearance
            ));
        }
    }

    @Override
    public Map<String, PatternAnalysisResult> getPatternResults() {
        return this.patternResults;
    }

    @Override
    public void filterAndSortResults() {
        List<PatternAnalysisResult> filteredResults = new ArrayList<>();
        
        // Filter out patterns that haven't appeared recently
        for (PatternAnalysisResult result : patternResults.values()) {
            if (result.getGamesSinceLastAppearance() < 1000) {
                filteredResults.add(result);
            }
        }
        
        // Sort by estimated hit frequency (descending)
        filteredResults.sort(Comparator.comparingDouble(PatternAnalysisResult::getEstimatedHitFrequency).reversed());
        
        // Rebuild the map with filtered and sorted results
        patternResults.clear();
        for (PatternAnalysisResult result : filteredResults) {
            patternResults.put(result.getPattern(), result);
        }
    }
}