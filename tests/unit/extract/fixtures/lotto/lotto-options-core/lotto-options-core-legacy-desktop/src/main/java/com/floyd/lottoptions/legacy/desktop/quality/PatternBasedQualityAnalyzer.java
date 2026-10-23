package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.grouping.PatternGroup;
import com.floyd.lottoptions.legacy.desktop.grouping.PatternGroupData;
import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Analyzes the quality of lottery tickets based on universal pattern analysis.
 * Works with lottery games of any size by extracting first-digit patterns and
 * evaluating tickets against HOT, WARM, and COLD pattern classifications to determine
 * optimization scores and comprehensive quality metrics.
 */
public class PatternBasedQualityAnalyzer {

    // Weighting factors for different quality aspects
    private static final double HOT_PATTERN_WEIGHT = 0.4;
    private static final double COVERAGE_WEIGHT = 0.25;
    private static final double DIVERSITY_WEIGHT = 0.2;
    private static final double BALANCE_WEIGHT = 0.15;

    /**
     * Analyzes a set of lottery tickets and calculates comprehensive quality metrics.
     *
     * @param tickets List of lottery tickets (each ticket is an int array)
     * @param patternGroupData The pattern group classifications (HOT/WARM/COLD)
     * @param totalPossibleNumbers The total number range for the lottery
     * @return QualityMetrics containing comprehensive analysis results
     */
    public QualityMetrics analyzeTicketQuality(List<int[]> tickets, PatternGroupData patternGroupData, int totalPossibleNumbers, LotteryPersistenceClient persistenceClient) {
        if (tickets == null || tickets.isEmpty()) {
            return createEmptyQualityMetrics(patternGroupData.getLotteryConfigId());
        }

        // Calculate individual metric components
        double hotPatternScore = calculateHotPatternScore(tickets, patternGroupData);
        double coverageScore = calculateCoverageScore(tickets, totalPossibleNumbers);
        double diversityScore = calculateDiversityScore(tickets);
        double balanceScore = calculateBalanceScore(tickets, patternGroupData);

        // Calculate overall optimization score (weighted average)
        double optimizationScore = (hotPatternScore * HOT_PATTERN_WEIGHT) +
                                  (coverageScore * COVERAGE_WEIGHT) +
                                  (diversityScore * DIVERSITY_WEIGHT) +
                                  (balanceScore * BALANCE_WEIGHT);

        // Calculate detailed metrics
        Map<String, Double> patternDistribution = calculatePatternDistribution(tickets, patternGroupData);
        double coveragePercentage = calculateCoveragePercentage(tickets, totalPossibleNumbers);
        double consecutiveRate = calculateConsecutiveRate(tickets);
        double repeatRate = calculateRepeatRate(tickets);
        double uniquenessScore = calculateUniquenessScore(tickets);
        double overlapPercentage = calculateOverlapPercentage(tickets);

        // Assign quality grade
        String qualityGrade = assignQualityGrade(optimizationScore);

        // Calculate improvement metrics for this analysis
        ImprovementCalculator improvementCalc = new ImprovementCalculator(persistenceClient);
        ImprovementMetrics improvementMetrics = improvementCalc.calculateImprovement(
            tickets, "tier_3", patternGroupData.getLotteryConfigId()); // Default to tier_3 for now
        
        return new QualityMetrics(
                optimizationScore,
                qualityGrade,
                patternDistribution,
                coveragePercentage,
                consecutiveRate,
                repeatRate,
                uniquenessScore,
                overlapPercentage,
                tickets.size(),
                patternGroupData.getLotteryConfigId(),
                improvementMetrics
        );
    }

    /**
     * Calculates the hot pattern score based on HOT pattern usage.
     */
    private double calculateHotPatternScore(List<int[]> tickets, PatternGroupData patternGroupData) {
        int hotPatternCount = 0;
        int totalPatterns = tickets.size();

        for (int[] ticket : tickets) {
            String pattern = extractFirstDigitPattern(ticket);
            Optional<PatternGroup> group = patternGroupData.findPatternGroup(pattern);
            Optional<PatternGroup> hotGroup = patternGroupData.getHotPatterns();
            
            if (group.isPresent() && hotGroup.isPresent() && group.get() == hotGroup.get()) {
                hotPatternCount++;
            }
        }

        return totalPatterns > 0 ? (double) hotPatternCount / totalPatterns * 100.0 : 0.0;
    }

    /**
     * Calculates coverage score based on number range utilization.
     */
    private double calculateCoverageScore(List<int[]> tickets, int totalPossibleNumbers) {
        Set<Integer> uniqueNumbers = new HashSet<>();
        for (int[] ticket : tickets) {
            for (int number : ticket) {
                uniqueNumbers.add(number);
            }
        }
        
        double coverage = (double) uniqueNumbers.size() / totalPossibleNumbers * 100.0;
        
        // Optimal coverage is around 60-80%, penalize too high or too low
        if (coverage >= 60.0 && coverage <= 80.0) {
            return 100.0;
        } else if (coverage >= 40.0 && coverage < 60.0) {
            return 75.0;
        } else if (coverage > 80.0 && coverage <= 90.0) {
            return 85.0;
        } else {
            return 50.0;
        }
    }

    /**
     * Calculates diversity score based on ticket uniqueness.
     */
    private double calculateDiversityScore(List<int[]> tickets) {
        Set<String> uniqueTickets = new HashSet<>();
        for (int[] ticket : tickets) {
            Arrays.sort(ticket);
            uniqueTickets.add(Arrays.toString(ticket));
        }
        
        return tickets.size() > 0 ? (double) uniqueTickets.size() / tickets.size() * 100.0 : 0.0;
    }

    /**
     * Calculates balance score based on HOT/WARM/COLD distribution.
     */
    private double calculateBalanceScore(List<int[]> tickets, PatternGroupData patternGroupData) {
        Map<String, Double> distribution = calculatePatternDistribution(tickets, patternGroupData);
        
        double hotPercentage = distribution.getOrDefault("HOT", 0.0);
        double warmPercentage = distribution.getOrDefault("WARM", 0.0);
        double coldPercentage = distribution.getOrDefault("COLD", 0.0);
        
        // Optimal balance: 40-50% HOT, 30-40% WARM, 10-30% COLD
        double balanceScore = 0.0;
        
        if (hotPercentage >= 40.0 && hotPercentage <= 50.0) balanceScore += 40.0;
        else if (hotPercentage >= 30.0 && hotPercentage < 40.0) balanceScore += 30.0;
        else if (hotPercentage > 50.0 && hotPercentage <= 60.0) balanceScore += 35.0;
        else balanceScore += 20.0;
        
        if (warmPercentage >= 30.0 && warmPercentage <= 40.0) balanceScore += 35.0;
        else if (warmPercentage >= 20.0 && warmPercentage < 30.0) balanceScore += 25.0;
        else balanceScore += 15.0;
        
        if (coldPercentage >= 10.0 && coldPercentage <= 30.0) balanceScore += 25.0;
        else if (coldPercentage < 10.0) balanceScore += 15.0;
        else balanceScore += 10.0;
        
        return balanceScore;
    }

    /**
     * Calculates the distribution of patterns across HOT/WARM/COLD groups.
     */
    private Map<String, Double> calculatePatternDistribution(List<int[]> tickets, PatternGroupData patternGroupData) {
        Map<String, Integer> counts = new HashMap<>();
        counts.put("HOT", 0);
        counts.put("WARM", 0);
        counts.put("COLD", 0);
        counts.put("UNKNOWN", 0);

        for (int[] ticket : tickets) {
            String pattern = extractFirstDigitPattern(ticket);
            Optional<String> groupType = patternGroupData.findPatternGroupType(pattern);
            
            if (groupType.isPresent()) {
                counts.merge(groupType.get(), 1, Integer::sum);
            } else {
                counts.merge("UNKNOWN", 1, Integer::sum);
            }
        }

        int totalTickets = tickets.size();
        Map<String, Double> distribution = new HashMap<>();
        
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            double percentage = totalTickets > 0 ? (double) entry.getValue() / totalTickets * 100.0 : 0.0;
            distribution.put(entry.getKey(), percentage);
        }

        return distribution;
    }

    /**
     * Calculates coverage percentage of unique numbers.
     */
    private double calculateCoveragePercentage(List<int[]> tickets, int totalPossibleNumbers) {
        Set<Integer> uniqueNumbers = new HashSet<>();
        for (int[] ticket : tickets) {
            for (int number : ticket) {
                uniqueNumbers.add(number);
            }
        }
        return (double) uniqueNumbers.size() / totalPossibleNumbers * 100.0;
    }

    /**
     * Calculates the rate of consecutive numbers in tickets.
     */
    private double calculateConsecutiveRate(List<int[]> tickets) {
        int consecutiveCount = 0;
        
        for (int[] ticket : tickets) {
            Arrays.sort(ticket);
            for (int i = 0; i < ticket.length - 1; i++) {
                if (ticket[i + 1] == ticket[i] + 1) {
                    consecutiveCount++;
                }
            }
        }
        
        int totalNumberPairs = tickets.size() * (tickets.get(0).length - 1);
        return totalNumberPairs > 0 ? (double) consecutiveCount / totalNumberPairs * 100.0 : 0.0;
    }

    /**
     * Calculates repeat rate (placeholder - would need recent draw history).
     */
    private double calculateRepeatRate(List<int[]> tickets) {
        // For now, return a neutral value
        // In full implementation, would compare against recent draw results
        return 15.0;
    }

    /**
     * Calculates uniqueness score based on ticket diversity.
     */
    private double calculateUniquenessScore(List<int[]> tickets) {
        return calculateDiversityScore(tickets);
    }

    /**
     * Calculates overlap percentage between tickets.
     */
    private double calculateOverlapPercentage(List<int[]> tickets) {
        if (tickets.size() < 2) return 0.0;
        
        int totalOverlaps = 0;
        int comparisons = 0;
        
        for (int i = 0; i < tickets.size(); i++) {
            for (int j = i + 1; j < tickets.size(); j++) {
                Set<Integer> set1 = Arrays.stream(tickets.get(i)).boxed().collect(Collectors.toSet());
                Set<Integer> set2 = Arrays.stream(tickets.get(j)).boxed().collect(Collectors.toSet());
                
                set1.retainAll(set2);  // Intersection
                totalOverlaps += set1.size();
                comparisons++;
            }
        }
        
        int ticketSize = tickets.get(0).length;
        return comparisons > 0 ? (double) totalOverlaps / (comparisons * ticketSize) * 100.0 : 0.0;
    }

    /**
     * Assigns a quality grade (A-F) based on optimization score.
     */
    private String assignQualityGrade(double optimizationScore) {
        if (optimizationScore >= 85.0) return "A";
        if (optimizationScore >= 70.0) return "B";
        if (optimizationScore >= 55.0) return "C";
        if (optimizationScore >= 40.0) return "D";
        return "F";
    }

    /**
     * Extracts first-digit pattern from a ticket.
     * Works universally with any ticket size (5, 6, 7+ numbers).
     */
    private String extractFirstDigitPattern(int[] ticket) {
        Arrays.sort(ticket);
        
        List<Integer> firstDigits = Arrays.stream(ticket)
                .mapToObj(this::getFirstDigit)
                .collect(Collectors.toList());

        List<Integer> uniqueDigits = firstDigits.stream()
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        StringBuilder pattern = new StringBuilder();
        for (Integer digit : firstDigits) {
            int position = uniqueDigits.indexOf(digit);
            pattern.append(position);
        }

        return pattern.toString();
    }

    /**
     * Gets the first digit of a number (0 for single-digit numbers).
     * Universal logic that works for any lottery number range.
     */
    private int getFirstDigit(int number) {
        if (number < 10) {
            return 0;
        }
        return Integer.parseInt(String.valueOf(number).substring(0, 1));
    }

    /**
     * Creates empty quality metrics for error cases.
     */
    private QualityMetrics createEmptyQualityMetrics(String lotteryConfigId) {
        Map<String, Double> emptyDistribution = new HashMap<>();
        emptyDistribution.put("HOT", 0.0);
        emptyDistribution.put("WARM", 0.0);
        emptyDistribution.put("COLD", 0.0);
        
        ImprovementMetrics emptyImprovement = new ImprovementMetrics(0.0, 0.0, 0.0, false, "unknown");
        return new QualityMetrics(0.0, "F", emptyDistribution, 0.0, 0.0, 0.0, 0.0, 0.0, 0, lotteryConfigId, emptyImprovement);
    }
}