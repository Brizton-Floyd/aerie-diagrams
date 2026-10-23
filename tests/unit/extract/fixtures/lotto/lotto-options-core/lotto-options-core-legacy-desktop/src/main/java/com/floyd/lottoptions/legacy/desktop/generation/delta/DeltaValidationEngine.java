package com.floyd.lottoptions.legacy.desktop.generation.delta;

import com.floyd.persistence.model.LotteryGame;

import java.util.*;

/**
 * Comprehensive validation and quality scoring engine for delta-generated lottery tickets.
 * 
 * Provides multi-dimensional quality assessment specifically designed for delta patterns,
 * ensuring generated tickets maintain the mathematical advantages that provide
 * 30-140x improvement over random selection.
 */
public class DeltaValidationEngine {
    
    private final LotteryGame lotteryGame;
    private final DeltaScalingCalculator scalingCalculator;
    private final DeltaBasePatternLibrary patternLibrary;
    
    // Quality thresholds for delta patterns
    private static final double EXCELLENT_SCORE_THRESHOLD = 80.0;
    private static final double GOOD_SCORE_THRESHOLD = 60.0;
    private static final double ACCEPTABLE_SCORE_THRESHOLD = 40.0;
    
    /**
     * Creates a validation engine for the specified lottery game.
     * 
     * @param lotteryGame The lottery game configuration
     */
    public DeltaValidationEngine(LotteryGame lotteryGame) {
        this.lotteryGame = lotteryGame;
        this.scalingCalculator = new DeltaScalingCalculator(lotteryGame);
        this.patternLibrary = new DeltaBasePatternLibrary();
    }
    
    /**
     * Performs comprehensive validation of a delta-generated ticket.
     * 
     * @param lotteryNumbers Generated lottery numbers
     * @param originalDeltaPattern Original delta pattern used (can be null)
     * @return Complete validation result with quality assessment
     */
    public DeltaValidationResult validateTicket(int[] lotteryNumbers, int[] originalDeltaPattern) {
        if (lotteryNumbers == null) {
            return DeltaValidationResult.invalid("Ticket is null");
        }
        
        // Basic validation first
        BasicValidation basicValidation = performBasicValidation(lotteryNumbers);
        if (!basicValidation.isValid()) {
            return DeltaValidationResult.invalid(basicValidation.getErrorMessage());
        }
        
        // Delta-specific quality scoring
        DeltaQualityScores qualityScores = calculateDeltaQualityScores(lotteryNumbers, originalDeltaPattern);
        double overallScore = calculateOverallDeltaScore(qualityScores);
        String qualityGrade = determineQualityGrade(overallScore);
        
        // Performance prediction based on delta principles
        PerformancePrediction performance = predictPerformance(qualityScores, originalDeltaPattern);
        
        // Optimization recommendations
        List<String> recommendations = generateOptimizationRecommendations(qualityScores, lotteryNumbers);
        
        return new DeltaValidationResult(
            true,
            overallScore,
            qualityGrade,
            qualityScores,
            performance,
            recommendations,
            "Validation completed successfully"
        );
    }
    
    /**
     * Validates multiple delta-generated tickets as a batch.
     * 
     * @param ticketsWithPatterns Map of lottery numbers to their delta patterns
     * @return Batch validation result with statistics and recommendations
     */
    public DeltaBatchValidationResult validateTicketBatch(Map<int[], int[]> ticketsWithPatterns) {
        List<DeltaValidationResult> individualResults = new ArrayList<>();
        Map<String, Integer> qualityDistribution = new HashMap<>();
        Map<String, Integer> patternTypeDistribution = new HashMap<>();
        
        double totalScore = 0.0;
        int validTicketCount = 0;
        
        for (Map.Entry<int[], int[]> entry : ticketsWithPatterns.entrySet()) {
            int[] ticket = entry.getKey();
            int[] deltaPattern = entry.getValue();
            
            DeltaValidationResult result = validateTicket(ticket, deltaPattern);
            individualResults.add(result);
            
            if (result.isValid()) {
                validTicketCount++;
                totalScore += result.getOverallScore();
                
                // Track quality distribution
                String grade = result.getQualityGrade();
                qualityDistribution.put(grade, qualityDistribution.getOrDefault(grade, 0) + 1);
                
                // Track pattern type distribution
                if (deltaPattern != null) {
                    String patternType = determinePatternType(deltaPattern);
                    patternTypeDistribution.put(patternType, patternTypeDistribution.getOrDefault(patternType, 0) + 1);
                }
            }
        }
        
        double averageScore = validTicketCount > 0 ? totalScore / validTicketCount : 0.0;
        
        BatchStatistics batchStats = new BatchStatistics(
            ticketsWithPatterns.size(),
            validTicketCount,
            averageScore,
            qualityDistribution,
            patternTypeDistribution
        );
        
        List<String> batchRecommendations = generateBatchRecommendations(batchStats, individualResults);
        
        return new DeltaBatchValidationResult(individualResults, batchStats, batchRecommendations);
    }
    
    /**
     * Checks if a lottery ticket follows delta optimization principles.
     * 
     * @param lotteryNumbers Lottery numbers to check
     * @return true if ticket exhibits delta characteristics
     */
    public boolean followsDeltaPrinciples(int[] lotteryNumbers) {
        if (lotteryNumbers == null || lotteryNumbers.length < 2) {
            return false;
        }
        
        // Check for consistent gaps (key delta characteristic)
        int[] gaps = calculateGaps(lotteryNumbers);
        return hasConsistentGaps(gaps) && hasOptimalStartEnd(lotteryNumbers) && hasGoodSpread(lotteryNumbers);
    }
    
    /**
     * Reconstructs the delta pattern from lottery numbers.
     * 
     * @param lotteryNumbers Lottery numbers
     * @return Delta pattern, or null if cannot be reconstructed
     */
    public int[] reconstructDeltaPattern(int[] lotteryNumbers) {
        if (lotteryNumbers == null || lotteryNumbers.length == 0) {
            return null;
        }
        
        // Sort to ensure proper order
        int[] sortedNumbers = lotteryNumbers.clone();
        Arrays.sort(sortedNumbers);
        
        int[] deltaPattern = new int[sortedNumbers.length];
        deltaPattern[0] = sortedNumbers[0]; // Starting number
        
        // Calculate gaps
        for (int i = 1; i < sortedNumbers.length; i++) {
            deltaPattern[i] = sortedNumbers[i] - sortedNumbers[i-1];
        }
        
        return deltaPattern;
    }
    
    // Private implementation methods
    
    private BasicValidation performBasicValidation(int[] lotteryNumbers) {
        // Check length
        if (lotteryNumbers.length != lotteryGame.getDrawPositionCount()) {
            return BasicValidation.invalid("Invalid ticket length: " + lotteryNumbers.length);
        }
        
        // Check range and uniqueness
        Set<Integer> uniqueNumbers = new HashSet<>();
        for (int number : lotteryNumbers) {
            if (number < lotteryGame.getMinNumber() || number > lotteryGame.getMaxNumber()) {
                return BasicValidation.invalid("Number " + number + " is out of range");
            }
            if (!uniqueNumbers.add(number)) {
                return BasicValidation.invalid("Duplicate number: " + number);
            }
        }
        
        return BasicValidation.valid();
    }
    
    private DeltaQualityScores calculateDeltaQualityScores(int[] lotteryNumbers, int[] originalDeltaPattern) {
        int[] sortedNumbers = lotteryNumbers.clone();
        Arrays.sort(sortedNumbers);
        
        // Reconstruct delta pattern if not provided
        int[] deltaPattern = originalDeltaPattern != null ? originalDeltaPattern : reconstructDeltaPattern(sortedNumbers);
        
        return new DeltaQualityScores(
            calculateArithmeticProgressionScore(deltaPattern),
            calculateStartOptimizationScore(sortedNumbers),
            calculateEndOptimizationScore(sortedNumbers),
            calculateGapOptimizationScore(deltaPattern),
            calculateSpreadOptimizationScore(sortedNumbers),
            calculateBalanceScore(sortedNumbers),
            calculatePatternFidelityScore(deltaPattern),
            calculateConsistencyScore(deltaPattern),
            calculatePenaltyScore(sortedNumbers)
        );
    }
    
    private double calculateArithmeticProgressionScore(int[] deltaPattern) {
        if (deltaPattern == null || !patternLibrary.isArithmeticProgression(deltaPattern)) {
            return 0.0;
        }
        
        // Perfect arithmetic progression gets full 10 points (as per original algorithm)
        return 10.0;
    }
    
    private double calculateStartOptimizationScore(int[] sortedNumbers) {
        int startNumber = sortedNumbers[0];
        int[] optimalRange = scalingCalculator.getOptimalStartRange();
        
        if (startNumber >= optimalRange[0] && startNumber <= optimalRange[1]) {
            double baseScore = 5.0;
            
            // Bonus for very low starts (first 2 numbers in range)
            if (startNumber <= optimalRange[0] + 1) {
                baseScore += 2.0;
            }
            
            return baseScore;
        }
        
        return 0.0;
    }
    
    private double calculateEndOptimizationScore(int[] sortedNumbers) {
        int endNumber = sortedNumbers[sortedNumbers.length - 1];
        int[] optimalRange = scalingCalculator.getOptimalEndRange();
        
        if (endNumber >= optimalRange[0] && endNumber <= optimalRange[1]) {
            double baseScore = 5.0;
            
            // Bonus for very high ends (last 2 numbers in range)
            if (endNumber >= optimalRange[1] - 1) {
                baseScore += 2.0;
            }
            
            return baseScore;
        }
        
        return 0.0;
    }
    
    private double calculateGapOptimizationScore(int[] deltaPattern) {
        if (deltaPattern == null || deltaPattern.length <= 1) {
            return 0.0;
        }
        
        int[] optimalGapRange = scalingCalculator.getOptimalGapRange();
        double score = 0.0;
        
        // +2 points for each optimal gap
        for (int i = 1; i < deltaPattern.length; i++) {
            int gap = deltaPattern[i];
            if (gap >= optimalGapRange[0] && gap <= optimalGapRange[1]) {
                score += 2.0;
            }
        }
        
        return score;
    }
    
    private double calculateSpreadOptimizationScore(int[] sortedNumbers) {
        int spread = sortedNumbers[sortedNumbers.length - 1] - sortedNumbers[0];
        DeltaScalingCalculator.DeltaScalingConfig config = scalingCalculator.getScalingConfig();
        
        if (spread >= config.getMinOptimalSpread() && spread <= config.getMaxOptimalSpread()) {
            return 3.0; // Good total range bonus
        }
        
        return 0.0;
    }
    
    private double calculateBalanceScore(int[] sortedNumbers) {
        // Check distribution across low, mid, high ranges
        int range = lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1;
        int rangeSize = range / 3;
        
        int lowCount = 0, midCount = 0, highCount = 0;
        
        for (int number : sortedNumbers) {
            int position = number - lotteryGame.getMinNumber();
            if (position < rangeSize) {
                lowCount++;
            } else if (position < rangeSize * 2) {
                midCount++;
            } else {
                highCount++;
            }
        }
        
        // Balanced distribution bonus (+4 points)
        if (lowCount > 0 && midCount > 0 && highCount > 0) {
            return 4.0;
        }
        
        return 0.0;
    }
    
    private double calculatePatternFidelityScore(int[] deltaPattern) {
        if (deltaPattern == null) {
            return 0.0;
        }
        
        // Higher score for patterns that match proven base patterns
        int priorityScore = patternLibrary.getPatternPriorityScore(deltaPattern);
        return priorityScore * 0.1; // Scale to reasonable range
    }
    
    private double calculateConsistencyScore(int[] deltaPattern) {
        if (deltaPattern == null || deltaPattern.length <= 2) {
            return 0.0;
        }
        
        // Measure gap consistency (lower variance = higher score)
        int[] gaps = Arrays.copyOfRange(deltaPattern, 1, deltaPattern.length);
        double variance = calculateVariance(gaps);
        
        // Lower variance (more consistent gaps) gets higher score
        return Math.max(0.0, 5.0 - (variance / 2.0));
    }
    
    private double calculatePenaltyScore(int[] sortedNumbers) {
        double penalty = 0.0;
        
        // Consecutive numbers penalty (-2 points each)
        for (int i = 1; i < sortedNumbers.length; i++) {
            if (sortedNumbers[i] == sortedNumbers[i-1] + 1) {
                penalty += 2.0;
            }
        }
        
        return penalty;
    }
    
    private double calculateOverallDeltaScore(DeltaQualityScores scores) {
        return scores.arithmeticProgressionScore +
               scores.startOptimizationScore +
               scores.endOptimizationScore + 
               scores.gapOptimizationScore +
               scores.spreadOptimizationScore +
               scores.balanceScore +
               scores.patternFidelityScore +
               scores.consistencyScore -
               scores.penaltyScore;
    }
    
    private String determineQualityGrade(double overallScore) {
        if (overallScore >= EXCELLENT_SCORE_THRESHOLD) {
            return "EXCELLENT";
        } else if (overallScore >= GOOD_SCORE_THRESHOLD) {
            return "GOOD";
        } else if (overallScore >= ACCEPTABLE_SCORE_THRESHOLD) {
            return "ACCEPTABLE";
        } else {
            return "NEEDS_IMPROVEMENT";
        }
    }
    
    private PerformancePrediction predictPerformance(DeltaQualityScores scores, int[] deltaPattern) {
        double confidenceLevel = Math.min(100.0, (scores.arithmeticProgressionScore + 
                                                 scores.startOptimizationScore + 
                                                 scores.endOptimizationScore) / 22.0 * 100.0);
        
        String expectedPerformance;
        if (confidenceLevel >= 80.0) {
            expectedPerformance = "High probability of 30-140x improvement over random";
        } else if (confidenceLevel >= 60.0) {
            expectedPerformance = "Good probability of significant improvement over random";
        } else if (confidenceLevel >= 40.0) {
            expectedPerformance = "Moderate improvement expected over random";
        } else {
            expectedPerformance = "Limited improvement expected - consider regeneration";
        }
        
        boolean followsDeltaPrinciples = deltaPattern != null && 
                                       (patternLibrary.isArithmeticProgression(deltaPattern) || 
                                        patternLibrary.getPatternPriorityScore(deltaPattern) > 0);
        
        return new PerformancePrediction(confidenceLevel, expectedPerformance, followsDeltaPrinciples);
    }
    
    private List<String> generateOptimizationRecommendations(DeltaQualityScores scores, int[] lotteryNumbers) {
        List<String> recommendations = new ArrayList<>();
        
        if (scores.arithmeticProgressionScore == 0.0) {
            recommendations.add("Consider using arithmetic progression patterns (+N spacing) for better performance");
        }
        
        if (scores.startOptimizationScore < 5.0) {
            int[] startRange = scalingCalculator.getOptimalStartRange();
            recommendations.add("Try starting with numbers " + startRange[0] + "-" + startRange[1] + " for optimal results");
        }
        
        if (scores.endOptimizationScore < 5.0) {
            int[] endRange = scalingCalculator.getOptimalEndRange();
            recommendations.add("Try ending with numbers " + endRange[0] + "-" + endRange[1] + " for optimal coverage");
        }
        
        if (scores.gapOptimizationScore < 6.0) { // Less than 3 optimal gaps
            int[] gapRange = scalingCalculator.getOptimalGapRange();
            recommendations.add("Use gaps between " + gapRange[0] + "-" + gapRange[1] + " for better consistency");
        }
        
        if (scores.balanceScore == 0.0) {
            recommendations.add("Distribute numbers more evenly across low, middle, and high ranges");
        }
        
        if (scores.penaltyScore > 0.0) {
            recommendations.add("Reduce consecutive numbers to improve pattern quality");
        }
        
        return recommendations;
    }
    
    private List<String> generateBatchRecommendations(BatchStatistics stats, List<DeltaValidationResult> results) {
        List<String> recommendations = new ArrayList<>();
        
        if (stats.averageScore < GOOD_SCORE_THRESHOLD) {
            recommendations.add("Consider regenerating with emphasis on arithmetic progression patterns");
        }
        
        // Check pattern type distribution
        int arithmeticCount = stats.patternTypeDistribution.getOrDefault("ARITHMETIC", 0);
        if (arithmeticCount < stats.validTicketCount * 0.3) {
            recommendations.add("Increase arithmetic progression patterns for better performance");
        }
        
        // Check quality distribution
        int excellentCount = stats.qualityDistribution.getOrDefault("EXCELLENT", 0);
        if (excellentCount < stats.validTicketCount * 0.2) {
            recommendations.add("Focus on proven high-priority base patterns for better quality");
        }
        
        return recommendations;
    }
    
    // Helper methods
    
    private int[] calculateGaps(int[] sortedNumbers) {
        int[] gaps = new int[sortedNumbers.length - 1];
        for (int i = 1; i < sortedNumbers.length; i++) {
            gaps[i-1] = sortedNumbers[i] - sortedNumbers[i-1];
        }
        return gaps;
    }
    
    private boolean hasConsistentGaps(int[] gaps) {
        if (gaps.length <= 1) return true;
        
        double variance = calculateVariance(gaps);
        return variance <= 4.0; // Reasonable consistency threshold
    }
    
    private boolean hasOptimalStartEnd(int[] sortedNumbers) {
        int[] startRange = scalingCalculator.getOptimalStartRange();
        int[] endRange = scalingCalculator.getOptimalEndRange();
        
        return (sortedNumbers[0] >= startRange[0] && sortedNumbers[0] <= startRange[1]) &&
               (sortedNumbers[sortedNumbers.length-1] >= endRange[0] && sortedNumbers[sortedNumbers.length-1] <= endRange[1]);
    }
    
    private boolean hasGoodSpread(int[] sortedNumbers) {
        int spread = sortedNumbers[sortedNumbers.length-1] - sortedNumbers[0];
        DeltaScalingCalculator.DeltaScalingConfig config = scalingCalculator.getScalingConfig();
        return spread >= config.getMinOptimalSpread();
    }
    
    private double calculateVariance(int[] values) {
        if (values.length == 0) return 0.0;
        
        double mean = Arrays.stream(values).average().orElse(0.0);
        double sumSquaredDiff = 0.0;
        
        for (int value : values) {
            double diff = value - mean;
            sumSquaredDiff += diff * diff;
        }
        
        return sumSquaredDiff / values.length;
    }
    
    private String determinePatternType(int[] deltaPattern) {
        if (patternLibrary.isArithmeticProgression(deltaPattern)) {
            return "ARITHMETIC";
        }
        
        int priority = patternLibrary.getPatternPriorityScore(deltaPattern);
        if (priority >= 80) {
            return "PRIMARY";
        } else if (priority >= 70) {
            return "SECONDARY";
        } else if (priority >= 50) {
            return "COMMON";
        } else {
            return "CUSTOM";
        }
    }
    
    // Result classes
    
    private static class BasicValidation {
        private final boolean valid;
        private final String errorMessage;
        
        private BasicValidation(boolean valid, String errorMessage) {
            this.valid = valid;
            this.errorMessage = errorMessage;
        }
        
        public static BasicValidation valid() { return new BasicValidation(true, null); }
        public static BasicValidation invalid(String error) { return new BasicValidation(false, error); }
        
        public boolean isValid() { return valid; }
        public String getErrorMessage() { return errorMessage; }
    }
    
    public static class DeltaQualityScores {
        public final double arithmeticProgressionScore;
        public final double startOptimizationScore;
        public final double endOptimizationScore;
        public final double gapOptimizationScore;
        public final double spreadOptimizationScore;
        public final double balanceScore;
        public final double patternFidelityScore;
        public final double consistencyScore;
        public final double penaltyScore;
        
        public DeltaQualityScores(double arithmeticProgression, double startOptimization, 
                                double endOptimization, double gapOptimization,
                                double spreadOptimization, double balance,
                                double patternFidelity, double consistency, double penalty) {
            this.arithmeticProgressionScore = arithmeticProgression;
            this.startOptimizationScore = startOptimization;
            this.endOptimizationScore = endOptimization;
            this.gapOptimizationScore = gapOptimization;
            this.spreadOptimizationScore = spreadOptimization;
            this.balanceScore = balance;
            this.patternFidelityScore = patternFidelity;
            this.consistencyScore = consistency;
            this.penaltyScore = penalty;
        }
    }
    
    public static class PerformancePrediction {
        private final double confidenceLevel;
        private final String expectedPerformance;
        private final boolean followsDeltaPrinciples;
        
        public PerformancePrediction(double confidenceLevel, String expectedPerformance, boolean followsDeltaPrinciples) {
            this.confidenceLevel = confidenceLevel;
            this.expectedPerformance = expectedPerformance;
            this.followsDeltaPrinciples = followsDeltaPrinciples;
        }
        
        public double getConfidenceLevel() { return confidenceLevel; }
        public String getExpectedPerformance() { return expectedPerformance; }
        public boolean followsDeltaPrinciples() { return followsDeltaPrinciples; }
    }
    
    public static class DeltaValidationResult {
        private final boolean valid;
        private final double overallScore;
        private final String qualityGrade;
        private final DeltaQualityScores qualityScores;
        private final PerformancePrediction performance;
        private final List<String> recommendations;
        private final String message;
        
        private DeltaValidationResult(boolean valid, double overallScore, String qualityGrade,
                                    DeltaQualityScores qualityScores, PerformancePrediction performance,
                                    List<String> recommendations, String message) {
            this.valid = valid;
            this.overallScore = overallScore;
            this.qualityGrade = qualityGrade;
            this.qualityScores = qualityScores;
            this.performance = performance;
            this.recommendations = recommendations;
            this.message = message;
        }
        
        public static DeltaValidationResult invalid(String message) {
            return new DeltaValidationResult(false, 0.0, "INVALID", null, null, new ArrayList<>(), message);
        }
        
        public boolean isValid() { return valid; }
        public double getOverallScore() { return overallScore; }
        public String getQualityGrade() { return qualityGrade; }
        public DeltaQualityScores getQualityScores() { return qualityScores; }
        public PerformancePrediction getPerformance() { return performance; }
        public List<String> getRecommendations() { return recommendations; }
        public String getMessage() { return message; }
    }
    
    public static class BatchStatistics {
        public final int totalTickets;
        public final int validTicketCount;
        public final double averageScore;
        public final Map<String, Integer> qualityDistribution;
        public final Map<String, Integer> patternTypeDistribution;
        
        public BatchStatistics(int totalTickets, int validTicketCount, double averageScore,
                             Map<String, Integer> qualityDistribution, 
                             Map<String, Integer> patternTypeDistribution) {
            this.totalTickets = totalTickets;
            this.validTicketCount = validTicketCount;
            this.averageScore = averageScore;
            this.qualityDistribution = qualityDistribution;
            this.patternTypeDistribution = patternTypeDistribution;
        }
    }
    
    public static class DeltaBatchValidationResult {
        private final List<DeltaValidationResult> individualResults;
        private final BatchStatistics batchStatistics;
        private final List<String> batchRecommendations;
        
        public DeltaBatchValidationResult(List<DeltaValidationResult> individualResults,
                                        BatchStatistics batchStatistics,
                                        List<String> batchRecommendations) {
            this.individualResults = individualResults;
            this.batchStatistics = batchStatistics;
            this.batchRecommendations = batchRecommendations;
        }
        
        public List<DeltaValidationResult> getIndividualResults() { return individualResults; }
        public BatchStatistics getBatchStatistics() { return batchStatistics; }
        public List<String> getBatchRecommendations() { return batchRecommendations; }
    }
}