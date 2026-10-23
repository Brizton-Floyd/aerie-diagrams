package com.floyd.lottoptions.legacy.desktop.generation.advanced;

import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeDroughtAnalysis;
import com.floyd.lottoptions.legacy.desktop.generation.performance.PatternPerformanceAnalysis;
import com.floyd.persistence.model.LotteryGame;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Smart ticket validation and optimization system that evaluates
 * generated lottery tickets against multiple quality criteria and
 * provides optimization recommendations.
 */
public class SmartTicketValidator {
    
    private final LotteryGame lotteryGame;
    private final PrizeDroughtAnalysis droughtAnalysis;
    private final PatternPerformanceAnalysis patternAnalysis;
    
    // Validation thresholds
    private static final double MIN_SPREAD_PERCENTAGE = 0.6; // 60% of number range
    private static final double MAX_CONSECUTIVE_RATIO = 0.5; // Max 50% consecutive numbers
    private static final double MIN_ODD_EVEN_BALANCE = 0.3;  // Min 30% of either odd or even
    private static final double MIN_HIGH_LOW_BALANCE = 0.3;  // Min 30% of either high or low
    
    public SmartTicketValidator(LotteryGame lotteryGame, 
                               PrizeDroughtAnalysis droughtAnalysis,
                               PatternPerformanceAnalysis patternAnalysis) {
        this.lotteryGame = lotteryGame;
        this.droughtAnalysis = droughtAnalysis;
        this.patternAnalysis = patternAnalysis;
    }
    
    /**
     * Validates and scores a single ticket across multiple quality dimensions.
     */
    public TicketValidationResult validateTicket(int[] ticket) {
        if (ticket == null || ticket.length != lotteryGame.getDrawPositionCount()) {
            return TicketValidationResult.invalid("Invalid ticket format");
        }
        
        // Basic validation
        ValidationResult basicValidation = performBasicValidation(ticket);
        if (!basicValidation.isValid()) {
            return TicketValidationResult.invalid(basicValidation.getMessage());
        }
        
        // Quality scoring across multiple dimensions
        Map<String, Double> qualityScores = calculateQualityScores(ticket);
        double overallScore = calculateOverallScore(qualityScores);
        
        // Strategic alignment scoring
        double strategicScore = calculateStrategicScore(ticket);
        
        // Pattern analysis
        String patternAnalysis = analyzeTicketPattern(ticket);
        
        // Optimization suggestions
        List<String> suggestions = generateOptimizationSuggestions(ticket, qualityScores);
        
        return new TicketValidationResult(
            true,
            overallScore,
            strategicScore,
            qualityScores,
            patternAnalysis,
            suggestions,
            "Validation complete"
        );
    }
    
    /**
     * Validates multiple tickets and provides batch analysis.
     */
    public BatchValidationResult validateTickets(List<int[]> tickets) {
        List<TicketValidationResult> results = new ArrayList<>();
        Map<String, Integer> duplicateCount = new HashMap<>();
        Set<String> uniqueTickets = new HashSet<>();
        
        for (int i = 0; i < tickets.size(); i++) {
            int[] ticket = tickets.get(i);
            String ticketHash = Arrays.toString(ticket);
            
            TicketValidationResult result = validateTicket(ticket);
            results.add(result);
            
            // Check for duplicates
            if (uniqueTickets.contains(ticketHash)) {
                duplicateCount.put(ticketHash, duplicateCount.getOrDefault(ticketHash, 1) + 1);
            } else {
                uniqueTickets.add(ticketHash);
            }
        }
        
        // Calculate batch statistics
        BatchStatistics statistics = calculateBatchStatistics(results, duplicateCount);
        
        // Generate batch recommendations
        List<String> batchRecommendations = generateBatchRecommendations(results, statistics);
        
        return new BatchValidationResult(results, statistics, batchRecommendations);
    }
    
    /**
     * Optimizes a ticket by applying improvement suggestions.
     */
    public int[] optimizeTicket(int[] originalTicket) {
        TicketValidationResult validation = validateTicket(originalTicket);
        
        if (!validation.isValid() || validation.getOverallScore() >= 0.9) {
            return originalTicket; // Already optimal or invalid
        }
        
        int[] optimizedTicket = Arrays.copyOf(originalTicket, originalTicket.length);
        
        // Apply optimizations based on quality scores
        optimizedTicket = optimizeSpread(optimizedTicket, validation.getQualityScores());
        optimizedTicket = optimizeBalance(optimizedTicket, validation.getQualityScores());
        optimizedTicket = optimizeStrategicAlignment(optimizedTicket);
        
        return optimizedTicket;
    }
    
    /**
     * Performs basic validation checks.
     */
    private ValidationResult performBasicValidation(int[] ticket) {
        // Check for null or wrong length
        if (ticket == null) {
            return ValidationResult.invalid("Ticket is null");
        }
        
        if (ticket.length != lotteryGame.getDrawPositionCount()) {
            return ValidationResult.invalid("Ticket has wrong number of positions: " + ticket.length);
        }
        
        // Check number ranges
        for (int i = 0; i < ticket.length; i++) {
            int number = ticket[i];
            if (number < lotteryGame.getMinNumber() || number > lotteryGame.getMaxNumber()) {
                return ValidationResult.invalid("Number " + number + " is out of range");
            }
        }
        
        // Check for duplicates
        Set<Integer> seen = new HashSet<>();
        for (int number : ticket) {
            if (seen.contains(number)) {
                return ValidationResult.invalid("Duplicate number found: " + number);
            }
            seen.add(number);
        }
        
        // Check for proper sorting
        for (int i = 1; i < ticket.length; i++) {
            if (ticket[i] <= ticket[i-1]) {
                return ValidationResult.invalid("Ticket numbers are not properly sorted");
            }
        }
        
        return ValidationResult.valid();
    }
    
    /**
     * Calculates quality scores across multiple dimensions.
     */
    private Map<String, Double> calculateQualityScores(int[] ticket) {
        Map<String, Double> scores = new HashMap<>();
        
        scores.put("spread", calculateSpreadScore(ticket));
        scores.put("consecutiveBalance", calculateConsecutiveScore(ticket));
        scores.put("oddEvenBalance", calculateOddEvenScore(ticket));
        scores.put("highLowBalance", calculateHighLowScore(ticket));
        scores.put("sumBalance", calculateSumScore(ticket));
        scores.put("rangeDistribution", calculateRangeDistributionScore(ticket));
        scores.put("lastDigitVariety", calculateLastDigitScore(ticket));
        
        return scores;
    }
    
    /**
     * Calculates spread score (how well numbers are distributed).
     */
    private double calculateSpreadScore(int[] ticket) {
        int range = lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1;
        int actualSpread = ticket[ticket.length - 1] - ticket[0] + 1;
        double spreadRatio = (double) actualSpread / range;
        
        return Math.min(1.0, spreadRatio / MIN_SPREAD_PERCENTAGE);
    }
    
    /**
     * Calculates consecutive numbers score.
     */
    private double calculateConsecutiveScore(int[] ticket) {
        int consecutiveCount = 0;
        for (int i = 1; i < ticket.length; i++) {
            if (ticket[i] == ticket[i-1] + 1) {
                consecutiveCount++;
            }
        }
        
        double consecutiveRatio = (double) consecutiveCount / (ticket.length - 1);
        return consecutiveRatio <= MAX_CONSECUTIVE_RATIO ? 1.0 : 
               1.0 - (consecutiveRatio - MAX_CONSECUTIVE_RATIO) * 2;
    }
    
    /**
     * Calculates odd/even balance score.
     */
    private double calculateOddEvenScore(int[] ticket) {
        int oddCount = 0;
        for (int number : ticket) {
            if (number % 2 == 1) oddCount++;
        }
        
        double oddRatio = (double) oddCount / ticket.length;
        double evenRatio = 1.0 - oddRatio;
        
        // Both odd and even should be at least MIN_ODD_EVEN_BALANCE
        if (oddRatio >= MIN_ODD_EVEN_BALANCE && evenRatio >= MIN_ODD_EVEN_BALANCE) {
            return 1.0;
        } else {
            double imbalance = Math.max(
                Math.max(0, MIN_ODD_EVEN_BALANCE - oddRatio),
                Math.max(0, MIN_ODD_EVEN_BALANCE - evenRatio)
            );
            return 1.0 - (imbalance * 2);
        }
    }
    
    /**
     * Calculates high/low balance score.
     */
    private double calculateHighLowScore(int[] ticket) {
        int midPoint = (lotteryGame.getMinNumber() + lotteryGame.getMaxNumber()) / 2;
        int lowCount = 0;
        
        for (int number : ticket) {
            if (number <= midPoint) lowCount++;
        }
        
        double lowRatio = (double) lowCount / ticket.length;
        double highRatio = 1.0 - lowRatio;
        
        if (lowRatio >= MIN_HIGH_LOW_BALANCE && highRatio >= MIN_HIGH_LOW_BALANCE) {
            return 1.0;
        } else {
            double imbalance = Math.max(
                Math.max(0, MIN_HIGH_LOW_BALANCE - lowRatio),
                Math.max(0, MIN_HIGH_LOW_BALANCE - highRatio)
            );
            return 1.0 - (imbalance * 2);
        }
    }
    
    /**
     * Calculates sum balance score.
     */
    private double calculateSumScore(int[] ticket) {
        int sum = Arrays.stream(ticket).sum();
        int expectedSum = (lotteryGame.getMinNumber() + lotteryGame.getMaxNumber()) * 
                         lotteryGame.getDrawPositionCount() / 2;
        
        double deviation = Math.abs(sum - expectedSum) / (double) expectedSum;
        return Math.max(0.0, 1.0 - deviation);
    }
    
    /**
     * Calculates range distribution score.
     */
    private double calculateRangeDistributionScore(int[] ticket) {
        int range = lotteryGame.getMaxNumber() - lotteryGame.getMinNumber() + 1;
        int rangeSize = range / 5; // Divide into 5 ranges
        int[] rangeCounts = new int[5];
        
        for (int number : ticket) {
            int rangeIndex = Math.min(4, (number - lotteryGame.getMinNumber()) / rangeSize);
            rangeCounts[rangeIndex]++;
        }
        
        // Calculate how evenly distributed across ranges
        double idealCount = (double) ticket.length / 5;
        double totalDeviation = 0;
        
        for (int count : rangeCounts) {
            totalDeviation += Math.abs(count - idealCount);
        }
        
        return Math.max(0.0, 1.0 - (totalDeviation / ticket.length));
    }
    
    /**
     * Calculates last digit variety score.
     */
    private double calculateLastDigitScore(int[] ticket) {
        Set<Integer> lastDigits = new HashSet<>();
        for (int number : ticket) {
            lastDigits.add(number % 10);
        }
        
        return (double) lastDigits.size() / ticket.length;
    }
    
    /**
     * Calculates overall score from individual quality scores.
     */
    private double calculateOverallScore(Map<String, Double> qualityScores) {
        // Weighted average of quality scores
        Map<String, Double> weights = Map.of(
            "spread", 0.2,
            "consecutiveBalance", 0.15,
            "oddEvenBalance", 0.15,
            "highLowBalance", 0.15,
            "sumBalance", 0.1,
            "rangeDistribution", 0.15,
            "lastDigitVariety", 0.1
        );
        
        double weightedSum = 0.0;
        double totalWeight = 0.0;
        
        for (Map.Entry<String, Double> entry : qualityScores.entrySet()) {
            String dimension = entry.getKey();
            double score = entry.getValue();
            double weight = weights.getOrDefault(dimension, 0.1);
            
            weightedSum += score * weight;
            totalWeight += weight;
        }
        
        return totalWeight > 0 ? weightedSum / totalWeight : 0.0;
    }
    
    /**
     * Calculates strategic score based on drought and pattern analysis.
     */
    private double calculateStrategicScore(int[] ticket) {
        double droughtScore = calculateDroughtAlignmentScore(ticket);
        double patternScore = calculatePatternAlignmentScore(ticket);
        
        // Weight based on available intelligence
        boolean hasActiveDroughts = droughtAnalysis.hasActiveDroughts();
        boolean hasPatternData = patternAnalysis.hasSignificantData();
        
        if (hasActiveDroughts && hasPatternData) {
            return (droughtScore * 0.6) + (patternScore * 0.4);
        } else if (hasActiveDroughts) {
            return droughtScore;
        } else if (hasPatternData) {
            return patternScore;
        } else {
            return 0.7; // Neutral score when no strategic data available
        }
    }
    
    /**
     * Calculates how well ticket aligns with drought analysis.
     */
    private double calculateDroughtAlignmentScore(int[] ticket) {
        if (!droughtAnalysis.hasActiveDroughts()) {
            return 0.7; // Neutral when no droughts
        }
        
        String targetTier = droughtAnalysis.getHighestPriorityPrizeTier();
        double droughtWeight = droughtAnalysis.getTargetingWeight(targetTier);
        
        // Simplified scoring - in practice this would be more sophisticated
        // based on historical data about which numbers contribute to each prize tier
        return Math.min(1.0, 0.5 + (droughtWeight * 0.3));
    }
    
    /**
     * Calculates how well ticket aligns with pattern analysis.
     */
    private double calculatePatternAlignmentScore(int[] ticket) {
        if (!patternAnalysis.hasSignificantData()) {
            return 0.7; // Neutral when no pattern data
        }
        
        List<String> bestPatterns = patternAnalysis.getHighestSuccessRatePatterns(10);
        Map<String, Double> successRates = patternAnalysis.getPatternSuccessRates();
        
        // Check how many high-success patterns this ticket matches
        int matchingPatterns = 0;
        double totalSuccessRate = 0.0;
        
        for (String pattern : bestPatterns) {
            if (ticketMatchesPattern(ticket, pattern)) {
                matchingPatterns++;
                totalSuccessRate += successRates.getOrDefault(pattern, 0.5);
            }
        }
        
        if (matchingPatterns == 0) {
            return 0.5; // Below average when no patterns match
        }
        
        double averageSuccessRate = totalSuccessRate / matchingPatterns;
        return Math.min(1.0, averageSuccessRate);
    }
    
    /**
     * Analyzes the ticket's pattern characteristics.
     */
    private String analyzeTicketPattern(int[] ticket) {
        StringBuilder analysis = new StringBuilder();
        
        // Analyze spread
        int spread = ticket[ticket.length - 1] - ticket[0];
        analysis.append("Spread: ").append(spread).append(" numbers; ");
        
        // Analyze consecutive numbers
        int consecutive = countConsecutive(ticket);
        if (consecutive > 0) {
            analysis.append("Consecutive: ").append(consecutive).append(" pairs; ");
        }
        
        // Analyze odd/even
        int oddCount = (int) Arrays.stream(ticket).filter(n -> n % 2 == 1).count();
        analysis.append("Odd/Even: ").append(oddCount).append("/").append(ticket.length - oddCount).append("; ");
        
        // Analyze sum
        int sum = Arrays.stream(ticket).sum();
        analysis.append("Sum: ").append(sum);
        
        return analysis.toString();
    }
    
    /**
     * Generates optimization suggestions for a ticket.
     */
    private List<String> generateOptimizationSuggestions(int[] ticket, Map<String, Double> qualityScores) {
        List<String> suggestions = new ArrayList<>();
        
        for (Map.Entry<String, Double> entry : qualityScores.entrySet()) {
            String dimension = entry.getKey();
            double score = entry.getValue();
            
            if (score < 0.7) { // Below good threshold
                switch (dimension) {
                    case "spread":
                        suggestions.add("Consider using numbers with wider spread across the range");
                        break;
                    case "consecutiveBalance":
                        suggestions.add("Reduce consecutive numbers for better balance");
                        break;
                    case "oddEvenBalance":
                        suggestions.add("Balance odd and even numbers more evenly");
                        break;
                    case "highLowBalance":
                        suggestions.add("Balance high and low numbers more evenly");
                        break;
                    case "rangeDistribution":
                        suggestions.add("Distribute numbers more evenly across number ranges");
                        break;
                    case "lastDigitVariety":
                        suggestions.add("Use numbers with more varied last digits");
                        break;
                }
            }
        }
        
        return suggestions;
    }
    
    // Helper methods and classes...
    
    private int countConsecutive(int[] ticket) {
        int count = 0;
        for (int i = 1; i < ticket.length; i++) {
            if (ticket[i] == ticket[i-1] + 1) count++;
        }
        return count;
    }
    
    private boolean ticketMatchesPattern(int[] ticket, String pattern) {
        // Simplified pattern matching - in practice this would decode actual pattern format
        return pattern.hashCode() % 3 == Arrays.hashCode(ticket) % 3;
    }
    
    private int[] optimizeSpread(int[] ticket, Map<String, Double> qualityScores) {
        if (qualityScores.get("spread") >= 0.7) return ticket;
        
        // Implementation would adjust numbers to improve spread
        return ticket;
    }
    
    private int[] optimizeBalance(int[] ticket, Map<String, Double> qualityScores) {
        // Implementation would adjust numbers to improve balance
        return ticket;
    }
    
    private int[] optimizeStrategicAlignment(int[] ticket) {
        // Implementation would adjust numbers based on strategic analysis
        return ticket;
    }
    
    private BatchStatistics calculateBatchStatistics(List<TicketValidationResult> results, Map<String, Integer> duplicates) {
        int validCount = (int) results.stream().mapToInt(r -> r.isValid() ? 1 : 0).sum();
        double averageScore = results.stream().mapToDouble(TicketValidationResult::getOverallScore).average().orElse(0.0);
        double averageStrategic = results.stream().mapToDouble(TicketValidationResult::getStrategicScore).average().orElse(0.0);
        
        return new BatchStatistics(validCount, results.size(), duplicates.size(), averageScore, averageStrategic);
    }
    
    private List<String> generateBatchRecommendations(List<TicketValidationResult> results, BatchStatistics stats) {
        List<String> recommendations = new ArrayList<>();
        
        if (stats.getDuplicateCount() > 0) {
            recommendations.add("Remove " + stats.getDuplicateCount() + " duplicate tickets");
        }
        
        if (stats.getAverageOverallScore() < 0.7) {
            recommendations.add("Consider regenerating tickets with better quality parameters");
        }
        
        if (stats.getAverageStrategicScore() < 0.6) {
            recommendations.add("Improve strategic alignment with drought/pattern analysis");
        }
        
        return recommendations;
    }
    
    // Result classes...
    
    public static class ValidationResult {
        private final boolean valid;
        private final String message;
        
        private ValidationResult(boolean valid, String message) {
            this.valid = valid;
            this.message = message;
        }
        
        public static ValidationResult valid() { return new ValidationResult(true, "Valid"); }
        public static ValidationResult invalid(String message) { return new ValidationResult(false, message); }
        
        public boolean isValid() { return valid; }
        public String getMessage() { return message; }
    }
    
    public static class TicketValidationResult {
        private final boolean valid;
        private final double overallScore;
        private final double strategicScore;
        private final Map<String, Double> qualityScores;
        private final String patternAnalysis;
        private final List<String> suggestions;
        private final String message;
        
        public TicketValidationResult(boolean valid, double overallScore, double strategicScore,
                                     Map<String, Double> qualityScores, String patternAnalysis,
                                     List<String> suggestions, String message) {
            this.valid = valid;
            this.overallScore = overallScore;
            this.strategicScore = strategicScore;
            this.qualityScores = qualityScores;
            this.patternAnalysis = patternAnalysis;
            this.suggestions = suggestions;
            this.message = message;
        }
        
        public static TicketValidationResult invalid(String message) {
            return new TicketValidationResult(false, 0.0, 0.0, new HashMap<>(), "", new ArrayList<>(), message);
        }
        
        // Getters...
        public boolean isValid() { return valid; }
        public double getOverallScore() { return overallScore; }
        public double getStrategicScore() { return strategicScore; }
        public Map<String, Double> getQualityScores() { return qualityScores; }
        public String getPatternAnalysis() { return patternAnalysis; }
        public List<String> getSuggestions() { return suggestions; }
        public String getMessage() { return message; }
        
        public String getSummary() {
            return String.format("Valid: %b, Overall: %.2f, Strategic: %.2f, Suggestions: %d",
                valid, overallScore, strategicScore, suggestions.size());
        }
    }
    
    public static class BatchValidationResult {
        private final List<TicketValidationResult> results;
        private final BatchStatistics statistics;
        private final List<String> recommendations;
        
        public BatchValidationResult(List<TicketValidationResult> results, BatchStatistics statistics,
                                   List<String> recommendations) {
            this.results = results;
            this.statistics = statistics;
            this.recommendations = recommendations;
        }
        
        public List<TicketValidationResult> getResults() { return results; }
        public BatchStatistics getStatistics() { return statistics; }
        public List<String> getRecommendations() { return recommendations; }
    }
    
    public static class BatchStatistics {
        private final int validCount;
        private final int totalCount;
        private final int duplicateCount;
        private final double averageOverallScore;
        private final double averageStrategicScore;
        
        public BatchStatistics(int validCount, int totalCount, int duplicateCount,
                              double averageOverallScore, double averageStrategicScore) {
            this.validCount = validCount;
            this.totalCount = totalCount;
            this.duplicateCount = duplicateCount;
            this.averageOverallScore = averageOverallScore;
            this.averageStrategicScore = averageStrategicScore;
        }
        
        public int getValidCount() { return validCount; }
        public int getTotalCount() { return totalCount; }
        public int getDuplicateCount() { return duplicateCount; }
        public double getAverageOverallScore() { return averageOverallScore; }
        public double getAverageStrategicScore() { return averageStrategicScore; }
        
        public String getSummary() {
            return String.format("Valid: %d/%d, Duplicates: %d, Avg Quality: %.2f, Avg Strategic: %.2f",
                validCount, totalCount, duplicateCount, averageOverallScore, averageStrategicScore);
        }
    }
}