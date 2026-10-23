package com.floyd.lottoptions.legacy.desktop.grouping;

import com.floyd.lottoptions.legacy.desktop.shared.dashboard.StandardProbabilityCalculator;
import com.floyd.model.dashboard.PatternAnalysisResult;
import com.floyd.persistence.model.LotteryGame;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service responsible for analyzing lottery games and classifying first-digit patterns 
 * into HOT, WARM, and COLD groups based on their frequency and performance characteristics.
 */
public class PatternGroupingService {

    private final FirstDigitPatternAnalyzer patternAnalyzer;
    
    // Classification thresholds
    private static final double HOT_FREQUENCY_MULTIPLIER = 1.3;  // 30% above expected
    private static final double COLD_FREQUENCY_MULTIPLIER = 0.7; // 30% below expected
    private static final int HOT_MAX_GAMES_OUT = 20;
    private static final int COLD_MIN_GAMES_OUT = 50;
    
    // Efficiency multipliers for quality scoring
    private static final double HOT_EFFICIENCY = 1.2;
    private static final double WARM_EFFICIENCY = 1.0;
    private static final double COLD_EFFICIENCY = 0.8;

    /**
     * Constructs a PatternGroupingService with a standard probability calculator.
     */
    public PatternGroupingService() {
        this.patternAnalyzer = new FirstDigitPatternAnalyzer(new StandardProbabilityCalculator());
    }

    /**
     * Analyzes a lottery game and classifies patterns into HOT, WARM, and COLD groups.
     *
     * @param lotteryGame The lottery game with historical draw data
     * @param lotteryConfigId The lottery configuration ID (e.g., "cash_five", "powerball")
     * @return PatternGroupData containing classified pattern groups
     */
    public PatternGroupData analyzeAndClassifyPatterns(LotteryGame lotteryGame, String lotteryConfigId) {
        // Perform pattern analysis
        patternAnalyzer.analyze(lotteryGame);
        patternAnalyzer.filterAndSortResults();
        
        Map<String, PatternAnalysisResult> patternResults = patternAnalyzer.getPatternResults();
        
        // Classify patterns into groups
        Map<String, List<PatternAnalysisResult>> classifiedPatterns = classifyPatterns(patternResults);
        
        // Convert to PatternGroup objects
        Map<String, PatternGroup> patternGroups = new HashMap<>();
        
        patternGroups.put("HOT", createPatternGroup(classifiedPatterns.get("HOT"), HOT_EFFICIENCY));
        patternGroups.put("WARM", createPatternGroup(classifiedPatterns.get("WARM"), WARM_EFFICIENCY));
        patternGroups.put("COLD", createPatternGroup(classifiedPatterns.get("COLD"), COLD_EFFICIENCY));
        
        return new PatternGroupData(
                lotteryConfigId, 
                lotteryGame.getLotteryDraws().size(), 
                patternGroups
        );
    }

    /**
     * Classifies patterns into HOT, WARM, and COLD categories based on frequency and recency.
     *
     * @param patternResults Map of pattern analysis results
     * @return Map of classified patterns grouped by type
     */
    private Map<String, List<PatternAnalysisResult>> classifyPatterns(Map<String, PatternAnalysisResult> patternResults) {
        Map<String, List<PatternAnalysisResult>> classified = new HashMap<>();
        classified.put("HOT", new ArrayList<>());
        classified.put("WARM", new ArrayList<>());
        classified.put("COLD", new ArrayList<>());

        for (PatternAnalysisResult result : patternResults.values()) {
            String classification = determinePatternClassification(result);
            classified.get(classification).add(result);
        }

        return classified;
    }

    /**
     * Determines the classification (HOT, WARM, or COLD) for a single pattern.
     *
     * @param result The pattern analysis result
     * @return The classification string ("HOT", "WARM", or "COLD")
     */
    private String determinePatternClassification(PatternAnalysisResult result) {
        double actualFrequency = result.getFrequency();
        double expectedFrequency = result.getEstimatedHitFrequency();
        int gamesSinceLastAppearance = result.getGamesSinceLastAppearance();

        // HOT: High frequency and recent appearance
        if (actualFrequency >= (expectedFrequency * HOT_FREQUENCY_MULTIPLIER) && 
            gamesSinceLastAppearance <= HOT_MAX_GAMES_OUT) {
            return "HOT";
        }
        
        // COLD: Low frequency and overdue
        if (actualFrequency <= (expectedFrequency * COLD_FREQUENCY_MULTIPLIER) && 
            gamesSinceLastAppearance >= COLD_MIN_GAMES_OUT) {
            return "COLD";
        }
        
        // WARM: Everything else (moderate frequency/timing)
        return "WARM";
    }

    /**
     * Creates a PatternGroup from a list of pattern analysis results.
     *
     * @param results List of pattern analysis results
     * @param efficiencyMultiplier The efficiency multiplier for this group
     * @return A PatternGroup containing the patterns and their frequencies
     */
    private PatternGroup createPatternGroup(List<PatternAnalysisResult> results, double efficiencyMultiplier) {
        if (results == null || results.isEmpty()) {
            return new PatternGroup(Collections.emptyList(), Collections.emptyList(), efficiencyMultiplier);
        }

        List<String> patterns = results.stream()
                .map(PatternAnalysisResult::getPattern)
                .collect(Collectors.toList());

        List<Integer> frequencies = results.stream()
                .map(PatternAnalysisResult::getFrequency)
                .collect(Collectors.toList());

        return new PatternGroup(patterns, frequencies, efficiencyMultiplier);
    }

    /**
     * Checks if a lottery game is suitable for first-digit pattern analysis.
     * Excludes Pick 3/Pick 4 games.
     *
     * @param lotteryGame The lottery game to check
     * @return true if the game can be analyzed
     */
    public boolean canAnalyzeGame(LotteryGame lotteryGame) {
        return lotteryGame.getMaxNumber() > 9;
    }

    /**
     * Gets summary statistics about the pattern classification.
     *
     * @param patternGroupData The classified pattern group data
     * @return Map containing classification statistics
     */
    public Map<String, Integer> getClassificationSummary(PatternGroupData patternGroupData) {
        Map<String, Integer> summary = new HashMap<>();
        
        summary.put("HOT_COUNT", patternGroupData.getHotPatterns()
                .map(group -> group.getPatterns().size())
                .orElse(0));
        summary.put("WARM_COUNT", patternGroupData.getWarmPatterns()
                .map(group -> group.getPatterns().size())
                .orElse(0));
        summary.put("COLD_COUNT", patternGroupData.getColdPatterns()
                .map(group -> group.getPatterns().size())
                .orElse(0));
        
        int totalPatterns = summary.values().stream().mapToInt(Integer::intValue).sum();
        summary.put("TOTAL_PATTERNS", totalPatterns);
        
        return summary;
    }
}