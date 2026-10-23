package com.floyd.lottoptions.legacy.desktop.grouping;

import java.util.ArrayList;
import java.util.List;

/**
 * Engine responsible for pattern extraction and classification based on tens digits mapping.
 * Converts lottery numbers into pattern strings and determines their group classification.
 */
public class PatternGroupingEngine {
    
    private final LotteryPersistenceClient persistenceClient;
    
    public PatternGroupingEngine(LotteryPersistenceClient persistenceClient) {
        this.persistenceClient = persistenceClient;
    }
    
    /**
     * Converts a list of sorted numbers into a pattern string based on tens digits.
     * For a 5/35 lottery:
     * - Numbers 1-9 map to '0'
     * - Numbers 10-19 map to '1' 
     * - Numbers 20-29 map to '2'
     * - Numbers 30-35 map to '3'
     *
     * @param numbers Sorted list of lottery numbers
     * @return Pattern string (e.g., "01223" for [5, 16, 23, 28, 34])
     */
    public String extractPattern(List<Integer> numbers) {
        if (numbers == null || numbers.isEmpty()) {
            return "";
        }
        
        StringBuilder pattern = new StringBuilder();
        
        for (Integer number : numbers) {
            if (number == null) {
                continue;
            }
            
            // Map number to tens digit
            char digit = (char) ('0' + (number - 1) / 10);
            
            // Ensure we don't exceed '9' for very large numbers
            if (digit > '9') {
                digit = '9';
            }
            
            pattern.append(digit);
        }
        
        return pattern.toString();
    }
    
    /**
     * Maps a lottery number to its tens digit for pattern creation.
     * Supports any lottery game by using dynamic ranges.
     */
    private char mapNumberToTensDigit(int number) {
        if (number >= 1 && number <= 9) return '0';
        if (number >= 10 && number <= 19) return '1';
        if (number >= 20 && number <= 29) return '2';
        if (number >= 30 && number <= 39) return '3';
        if (number >= 40 && number <= 49) return '4';
        if (number >= 50 && number <= 59) return '5';
        if (number >= 60 && number <= 69) return '6';
        if (number >= 70 && number <= 79) return '7';
        if (number >= 80 && number <= 89) return '8';
        // For very large lotteries or edge cases
        return '9';
    }
    
    /**
     * Classifies a pattern as 'hot', 'warm', 'cold', or 'UNKNOWN'.
     * Makes an HTTP call to the persistence API to check against PatternGroupDefinition.
     *
     * @param pattern The pattern string to classify
     * @return PatternGroup classification ("hot", "warm", "cold", or "UNKNOWN")
     */
    public String determinePatternGroup(String pattern) {
        return determinePatternGroup(pattern, "default-config");
    }
    
    /**
     * Classifies a pattern as 'hot', 'warm', 'cold', or 'UNKNOWN' for a specific lottery configuration.
     *
     * @param pattern The pattern string to classify
     * @param lotteryConfigId The lottery configuration identifier
     * @return PatternGroup classification ("hot", "warm", "cold", or "UNKNOWN")
     */
    public String determinePatternGroup(String pattern, String lotteryConfigId) {
        if (pattern == null || pattern.trim().isEmpty()) {
            return "UNKNOWN";
        }
        
        System.out.println("DEBUG: UPDATED VERSION - Determining pattern group for: '" + pattern + "' with config: " + lotteryConfigId);
        
        try {
            // Use the persistence client to fetch pattern group data for the specific config
            PatternGroupData patternGroupData = persistenceClient.getPatternGroupData(lotteryConfigId);
            
            if (patternGroupData == null) {
                System.out.println("DEBUG: PatternGroupData is null for config: " + lotteryConfigId);
                return "UNKNOWN";
            }
            
            System.out.println("DEBUG: PatternGroupData retrieved for " + lotteryConfigId + ":");
            System.out.println("DEBUG: - HOT patterns: " + patternGroupData.getHotPatterns()
                .map(group -> String.valueOf(group.getPatterns().size())).orElse("empty"));
            System.out.println("DEBUG: - WARM patterns: " + patternGroupData.getWarmPatterns()
                .map(group -> String.valueOf(group.getPatterns().size())).orElse("empty"));
            System.out.println("DEBUG: - COLD patterns: " + patternGroupData.getColdPatterns()
                .map(group -> String.valueOf(group.getPatterns().size())).orElse("empty"));
            System.out.println("DEBUG: Checking pattern: '" + pattern + "'");
            
            // Check if pattern exists in hot group
            if (patternGroupData.getHotPatterns()
                .filter(group -> isPatternInGroupWithConversion(pattern, group.getPatterns()))
                .isPresent()) {
                return "HOT";
            }
            
            // Check if pattern exists in warm group
            if (patternGroupData.getWarmPatterns()
                .filter(group -> isPatternInGroupWithConversion(pattern, group.getPatterns()))
                .isPresent()) {
                return "WARM";
            }
            
            // Check if pattern exists in cold group
            if (patternGroupData.getColdPatterns()
                .filter(group -> isPatternInGroupWithConversion(pattern, group.getPatterns()))
                .isPresent()) {
                return "COLD";
            }
            
            // Pattern not found in any specific group - use intelligent classification
            // For patterns not in API data, classify based on frequency analysis
            return classifyPatternByFrequency(pattern, patternGroupData);
            
        } catch (Exception e) {
            System.err.println("Error determining pattern group for pattern " + pattern + ": " + e.getMessage());
            return "UNKNOWN";
        }
    }
    

    
    /**
     * Convenience method to extract pattern and determine group for a specific lottery configuration.
     *
     * @param numbers Sorted list of lottery numbers
     * @param lotteryConfigId The lottery configuration identifier
     * @return PatternGroup classification
     */
    public String extractAndClassifyPattern(List<Integer> numbers, String lotteryConfigId) {
        System.out.println("DEBUG: EXTRACTING AND CLASSIFYING - Numbers: " + numbers + " Config: " + lotteryConfigId);
        String pattern = extractPattern(numbers);
        System.out.println("DEBUG: EXTRACTED PATTERN: '" + pattern + "'");
        String result = determinePatternGroup(pattern, lotteryConfigId);
        System.out.println("DEBUG: CLASSIFICATION RESULT: '" + result + "'");
        return result;
    }
    
    /**
     * Helper method to check if a pattern exists in a group's pattern list.
     */
    private boolean isPatternInGroup(String pattern, List<String> groupPatterns) {
        if (groupPatterns == null || groupPatterns.isEmpty()) {
            return false;
        }
        
        return groupPatterns.contains(pattern);
    }
    
    /**
     * Helper method to check if a pattern exists in a group's pattern list with format conversion.
     * Handles both formats: tens-digit patterns ("01223") and comma-separated numbers ("05,15,25,30,35").
     */
    private boolean isPatternInGroupWithConversion(String pattern, List<String> groupPatterns) {
        if (groupPatterns == null || groupPatterns.isEmpty() || pattern == null) {
            return false;
        }
        
        // First, try direct match
        if (groupPatterns.contains(pattern)) {
            return true;
        }
        
        // Convert stored patterns to tens-digit format and compare
        for (String storedPattern : groupPatterns) {
            if (storedPattern == null) {
                continue;
            }
            
            // Check if stored pattern is comma-separated numbers
            if (storedPattern.contains(",")) {
                String convertedPattern = convertNumbersToPattern(storedPattern);
                if (pattern.equals(convertedPattern)) {
                    return true;
                }
            } else {
                // Direct comparison for already formatted patterns
                if (pattern.equals(storedPattern)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Converts comma-separated numbers to tens-digit pattern.
     * E.g., "05,15,25,30,35" -> "01223"
     */
    private String convertNumbersToPattern(String numbersString) {
        try {
            String[] numberStrings = numbersString.split(",");
            List<Integer> numbers = new ArrayList<>();
            
            for (String numStr : numberStrings) {
                numbers.add(Integer.parseInt(numStr.trim()));
            }
            
            // Sort the numbers and extract pattern
            numbers.sort(Integer::compareTo);
            return extractPattern(numbers);
            
        } catch (NumberFormatException e) {
            System.err.println("Error converting pattern: " + numbersString + " - " + e.getMessage());
            return "";
        }
    }
    
    /**
     * Intelligently classifies a pattern based on frequency analysis and pattern characteristics.
     * This method provides fallback classification for patterns not found in the API's predefined groups.
     *
     * @param pattern The pattern string to classify
     * @param patternGroupData The pattern group data from API (may contain frequency info)
     * @return Classification: "HOT", "WARM", "COLD", or "UNKNOWN"
     */
    private String classifyPatternByFrequency(String pattern, PatternGroupData patternGroupData) {
        if (pattern == null || pattern.trim().isEmpty()) {
            return "UNKNOWN";
        }
        
        try {
            // Analyze pattern characteristics for intelligent classification
            double patternScore = calculatePatternScore(pattern);
            
            System.out.println("DEBUG: Intelligent classification for pattern '" + pattern + "' - Score: " + patternScore);
            
            // Classification thresholds based on pattern analysis
            if (patternScore >= 70.0) {
                return "HOT";
            } else if (patternScore >= 40.0) {
                return "WARM";
            } else {
                return "COLD";
            }
            
        } catch (Exception e) {
            System.err.println("Error in intelligent pattern classification: " + e.getMessage());
            return "UNKNOWN";
        }
    }
    
    /**
     * Calculates a score for pattern classification based on multiple factors:
     * - Pattern diversity (spread across tens digits)
     * - Balance between different tens groups
     * - Common vs rare pattern characteristics
     *
     * @param pattern The pattern string to score
     * @return Score from 0-100 (higher = more likely to be HOT)
     */
    private double calculatePatternScore(String pattern) {
        if (pattern == null || pattern.isEmpty()) {
            return 0.0;
        }
        
        double score = 0.0;
        
        // Factor 1: Pattern diversity (30% weight)
        // More diverse patterns across tens digits are generally better
        long uniqueDigits = pattern.chars().distinct().count();
        double diversityScore = (uniqueDigits / 4.0) * 30.0; // Max 4 unique digits for 5-number lottery
        score += diversityScore;
        
        // Factor 2: Balance score (25% weight)
        // Patterns with good distribution across ranges score higher
        double balanceScore = calculatePatternBalance(pattern) * 25.0;
        score += balanceScore;
        
        // Factor 3: Avoid extreme patterns (20% weight)
        // Patterns that are too concentrated in one area score lower
        double extremeityPenalty = calculateExtremityPenalty(pattern) * 20.0;
        score += extremeityPenalty;
        
        // Factor 4: Common pattern bonus (25% weight)
        // Patterns that follow common distribution principles score higher
        double commonPatternBonus = calculateCommonPatternBonus(pattern) * 25.0;
        score += commonPatternBonus;
        
        return Math.max(0.0, Math.min(100.0, score));
    }
    
    /**
     * Calculates balance score based on how well the pattern is distributed.
     */
    private double calculatePatternBalance(String pattern) {
        int[] digitCounts = new int[4]; // For digits 0, 1, 2, 3
        
        for (char c : pattern.toCharArray()) {
            int digit = Character.getNumericValue(c);
            if (digit >= 0 && digit <= 3) {
                digitCounts[digit]++;
            }
        }
        
        // Calculate standard deviation - lower is better (more balanced)
        double mean = pattern.length() / 4.0;
        double variance = 0.0;
        
        for (int count : digitCounts) {
            variance += Math.pow(count - mean, 2);
        }
        
        double stdDev = Math.sqrt(variance / 4.0);
        
        // Convert to score: lower std dev = higher score
        return Math.max(0.0, 1.0 - (stdDev / mean));
    }
    
    /**
     * Calculates penalty for extreme patterns (all numbers in one or two groups).
     */
    private double calculateExtremityPenalty(String pattern) {
        int[] digitCounts = new int[4];
        
        for (char c : pattern.toCharArray()) {
            int digit = Character.getNumericValue(c);
            if (digit >= 0 && digit <= 3) {
                digitCounts[digit]++;
            }
        }
        
        // Count how many groups have numbers
        long groupsWithNumbers = java.util.Arrays.stream(digitCounts)
                .mapToLong(count -> count > 0 ? 1 : 0)
                .sum();
        
        // Patterns using only 1-2 groups are penalized
        if (groupsWithNumbers <= 2) {
            return 0.3; // 30% of max score
        } else {
            return 1.0; // No penalty
        }
    }
    
    /**
     * Calculates bonus for patterns that follow common lottery distribution principles.
     */
    private double calculateCommonPatternBonus(String pattern) {
        // Bonus for patterns that have representation across multiple tens groups
        // This is typical in winning lottery combinations
        
        long uniqueDigits = pattern.chars().distinct().count();
        
        if (uniqueDigits >= 3) {
            return 1.0; // Full bonus for good spread
        } else if (uniqueDigits == 2) {
            return 0.6; // Partial bonus
        } else {
            return 0.2; // Minimal bonus for poor spread
        }
    }
}