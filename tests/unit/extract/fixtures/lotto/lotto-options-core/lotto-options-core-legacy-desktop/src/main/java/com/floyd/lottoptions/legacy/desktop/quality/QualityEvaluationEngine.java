package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.generation.criteria.StoppingCriteria;
import com.floyd.lottoptions.legacy.desktop.grouping.LotteryPersistenceClient;
import com.floyd.lottoptions.legacy.desktop.grouping.PatternGroupingEngine;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Engine responsible for evaluating the quality of generated lottery tickets.
 * Calculates comprehensive quality metrics including pattern grouping, number analysis, and diversity.
 */
public class QualityEvaluationEngine {
    
    private final PatternGroupingEngine patternGroupingEngine;
    private final LotteryPersistenceClient persistenceClient;
    
    public QualityEvaluationEngine(LotteryPersistenceClient persistenceClient) {
        this.persistenceClient = persistenceClient;
        this.patternGroupingEngine = new PatternGroupingEngine(persistenceClient);
    }
    
    /**
     * Evaluates the quality of a list of lottery tickets based on multiple criteria.
     *
     * @param tickets List of lottery tickets (each ticket is an int array)
     * @param stoppingCriteria The criteria used for generation (contains thresholds)
     * @param userRequest The original user request with preferences
     * @return QualityMetrics object with comprehensive analysis
     */
    public QualityMetrics evaluateQuality(List<int[]> tickets, StoppingCriteria stoppingCriteria, UserTargetingRequest userRequest) {
        if (tickets == null || tickets.isEmpty()) {
            return createEmptyQualityMetrics(userRequest.getLotteryConfigId());
        }
        
        // Calculate overall metrics
        double optimizationScore = calculateOptimizationScore(tickets, userRequest);
        String qualityGrade = calculateQualityGrade(optimizationScore);
        
        // Calculate pattern grouping metrics
        Map<String, Double> patternDistribution = calculatePatternGrouping(tickets, userRequest);
        
        // Calculate number analysis metrics
        NumberAnalysisMetrics numberAnalysis = calculateNumberAnalysis(tickets, userRequest);
        
        // Calculate diversity metrics
        DiversityMetrics diversity = calculateDiversityMetrics(tickets);
        
        // Calculate improvement metrics
        ImprovementCalculator improvementCalc = new ImprovementCalculator(persistenceClient);
        ImprovementMetrics improvementMetrics = improvementCalc.calculateImprovement(
            tickets, userRequest.getTargetTier(), userRequest.getLotteryConfigId());
        
        return new QualityMetrics(
            optimizationScore,
            qualityGrade,
            patternDistribution,
            numberAnalysis.getHotNumberCoverage(),
            numberAnalysis.getConsecutiveNumberRate(),
            diversity.getAverageOverlap(),
            diversity.getUniqueNumbers(),
            diversity.getAverageOverlap(),
            tickets.size(),
            userRequest.getLotteryConfigId(),
            improvementMetrics
        );
    }
    
    /**
     * Calculates overall optimization score (0-100) based on multiple factors.
     */
    private double calculateOptimizationScore(List<int[]> tickets, UserTargetingRequest userRequest) {
        double patternScore = calculatePatternScore(tickets, userRequest);
        double diversityScore = calculateDiversityScore(tickets);
        double coverageScore = calculateCoverageScore(tickets);
        double balanceScore = calculateBalanceScore(tickets);
        
        // Weighted combination
        return (patternScore * 0.4) + (diversityScore * 0.25) + (coverageScore * 0.2) + (balanceScore * 0.15);
    }
    
    /**
     * Calculates pattern grouping percentages (hot, warm, cold, unknown).
     */
    private Map<String, Double> calculatePatternGrouping(List<int[]> tickets, UserTargetingRequest userRequest) {
        System.out.println("DEBUG: CALCULATING PATTERN GROUPING - Tickets: " + tickets.size() + ", UserRequest: " + userRequest);
        System.out.println("DEBUG: LotteryConfigId from UserRequest: " + (userRequest != null ? userRequest.getLotteryConfigId() : "null"));
        
        Map<String, Integer> patternCounts = new HashMap<>();
        patternCounts.put("HOT", 0);
        patternCounts.put("WARM", 0);
        patternCounts.put("COLD", 0);
        patternCounts.put("UNKNOWN", 0);
        
        for (int[] ticket : tickets) {
            List<Integer> numbers = Arrays.stream(ticket).sorted().boxed().collect(Collectors.toList());
            System.out.println("DEBUG: Processing ticket: " + Arrays.toString(ticket) + " -> Numbers: " + numbers);
            String patternGroup = patternGroupingEngine.extractAndClassifyPattern(numbers, userRequest.getLotteryConfigId());
            System.out.println("DEBUG: Got pattern group: " + patternGroup);
            
            String key = patternGroup.toUpperCase();
            patternCounts.put(key, patternCounts.getOrDefault(key, 0) + 1);
        }
        
        // Convert counts to percentages
        Map<String, Double> distribution = new HashMap<>();
        int totalTickets = tickets.size();
        
        for (Map.Entry<String, Integer> entry : patternCounts.entrySet()) {
            double percentage = (double) entry.getValue() / totalTickets * 100.0;
            distribution.put(entry.getKey(), percentage);
        }
        
        return distribution;
    }
    
    /**
     * Calculates detailed number analysis metrics.
     */
    private NumberAnalysisMetrics calculateNumberAnalysis(List<int[]> tickets, UserTargetingRequest userRequest) {
        try {
            // Get hot numbers from persistence API
            List<Integer> hotNumbers = persistenceClient.getHotNumbers(userRequest.getLotteryConfigId());
            List<int[]> provenCombinations = persistenceClient.getProvenCombinations(userRequest.getLotteryConfigId());
            
            double hotNumberCoverage = calculateHotNumberCoverage(tickets, hotNumbers);
            Map<String, Double> numberDistribution = calculateNumberDistribution(tickets);
            double consecutiveNumberRate = calculateConsecutiveNumberRate(tickets);
            double provenCombinationUsage = calculateProvenCombinationUsage(tickets, provenCombinations);
            
            return new NumberAnalysisMetrics(hotNumberCoverage, numberDistribution, consecutiveNumberRate, provenCombinationUsage);
            
        } catch (Exception e) {
            System.err.println("Error calculating number analysis: " + e.getMessage());
            return new NumberAnalysisMetrics(0.0, new HashMap<>(), 0.0, 0.0);
        }
    }
    
    /**
     * Calculates diversity metrics for the ticket set.
     */
    private DiversityMetrics calculateDiversityMetrics(List<int[]> tickets) {
        Set<Integer> uniqueNumbers = new HashSet<>();
        for (int[] ticket : tickets) {
            for (int number : ticket) {
                uniqueNumbers.add(number);
            }
        }
        
        double averageOverlap = calculateAverageOverlap(tickets);
        
        return new DiversityMetrics(uniqueNumbers.size(), averageOverlap);
    }
    
    /**
     * Helper methods for specific calculations
     */
    
    private double calculatePatternScore(List<int[]> tickets, UserTargetingRequest userRequest) {
        Map<String, Double> patternDist = calculatePatternGrouping(tickets, userRequest);
        double hotPercentage = patternDist.getOrDefault("HOT", 0.0);
        double warmPercentage = patternDist.getOrDefault("WARM", 0.0);
        
        // Higher scores for more hot and warm patterns
        return (hotPercentage * 0.7) + (warmPercentage * 0.3);
    }
    
    private double calculateDiversityScore(List<int[]> tickets) {
        Set<String> uniqueTickets = new HashSet<>();
        for (int[] ticket : tickets) {
            uniqueTickets.add(Arrays.toString(ticket));
        }
        return ((double) uniqueTickets.size() / tickets.size()) * 100;
    }
    
    private double calculateCoverageScore(List<int[]> tickets) {
        Set<Integer> allNumbers = new HashSet<>();
        for (int[] ticket : tickets) {
            for (int number : ticket) {
                allNumbers.add(number);
            }
        }
        // Assume max range is 35 for scoring
        return ((double) allNumbers.size() / 35) * 100;
    }
    
    private double calculateBalanceScore(List<int[]> tickets) {
        int oddCount = 0, evenCount = 0;
        int totalNumbers = 0;
        
        for (int[] ticket : tickets) {
            for (int number : ticket) {
                if (number % 2 == 0) {
                    evenCount++;
                } else {
                    oddCount++;
                }
                totalNumbers++;
            }
        }
        
        if (totalNumbers == 0) return 0;
        
        double oddPercentage = ((double) oddCount / totalNumbers) * 100;
        double evenPercentage = ((double) evenCount / totalNumbers) * 100;
        
        // Better balance = higher score (closer to 50/50)
        return 100 - Math.abs(50 - oddPercentage);
    }
    
    private String calculateQualityGrade(double score) {
        if (score >= 85) return "A";
        if (score >= 70) return "B";
        if (score >= 55) return "C";
        if (score >= 40) return "D";
        return "F";
    }
    
    private double calculateHotNumberCoverage(List<int[]> tickets, List<Integer> hotNumbers) {
        if (hotNumbers == null || hotNumbers.isEmpty()) {
            return 0.0;
        }
        
        Set<Integer> usedHotNumbers = new HashSet<>();
        for (int[] ticket : tickets) {
            for (int number : ticket) {
                if (hotNumbers.contains(number)) {
                    usedHotNumbers.add(number);
                }
            }
        }
        
        return ((double) usedHotNumbers.size() / hotNumbers.size()) * 100;
    }
    
    private Map<String, Double> calculateNumberDistribution(List<int[]> tickets) {
        Map<String, Integer> rangeCounts = new HashMap<>();
        rangeCounts.put("1-7", 0);
        rangeCounts.put("8-14", 0);
        rangeCounts.put("15-21", 0);
        rangeCounts.put("22-28", 0);
        rangeCounts.put("29-35", 0);
        
        int totalNumbers = 0;
        for (int[] ticket : tickets) {
            for (int number : ticket) {
                totalNumbers++;
                if (number >= 1 && number <= 7) rangeCounts.put("1-7", rangeCounts.get("1-7") + 1);
                else if (number >= 8 && number <= 14) rangeCounts.put("8-14", rangeCounts.get("8-14") + 1);
                else if (number >= 15 && number <= 21) rangeCounts.put("15-21", rangeCounts.get("15-21") + 1);
                else if (number >= 22 && number <= 28) rangeCounts.put("22-28", rangeCounts.get("22-28") + 1);
                else if (number >= 29 && number <= 35) rangeCounts.put("29-35", rangeCounts.get("29-35") + 1);
            }
        }
        
        Map<String, Double> distribution = new HashMap<>();
        for (Map.Entry<String, Integer> entry : rangeCounts.entrySet()) {
            double percentage = totalNumbers > 0 ? ((double) entry.getValue() / totalNumbers) * 100 : 0;
            distribution.put(entry.getKey(), percentage);
        }
        
        return distribution;
    }
    
    private double calculateConsecutiveNumberRate(List<int[]> tickets) {
        int consecutivePairs = 0;
        int totalPairs = 0;
        
        for (int[] ticket : tickets) {
            Arrays.sort(ticket);
            for (int i = 0; i < ticket.length - 1; i++) {
                totalPairs++;
                if (ticket[i + 1] == ticket[i] + 1) {
                    consecutivePairs++;
                }
            }
        }
        
        return totalPairs > 0 ? ((double) consecutivePairs / totalPairs) * 100 : 0;
    }
    
    private double calculateProvenCombinationUsage(List<int[]> tickets, List<int[]> provenCombinations) {
        if (provenCombinations == null || provenCombinations.isEmpty()) {
            return 0.0;
        }
        
        int matchingTickets = 0;
        for (int[] ticket : tickets) {
            for (int[] proven : provenCombinations) {
                if (Arrays.equals(ticket, proven)) {
                    matchingTickets++;
                    break;
                }
            }
        }
        
        return ((double) matchingTickets / tickets.size()) * 100;
    }
    
    private double calculateAverageOverlap(List<int[]> tickets) {
        if (tickets.size() < 2) return 0.0;
        
        double totalOverlap = 0;
        int comparisons = 0;
        
        for (int i = 0; i < tickets.size(); i++) {
            for (int j = i + 1; j < tickets.size(); j++) {
                Set<Integer> ticket1 = Arrays.stream(tickets.get(i)).boxed().collect(Collectors.toSet());
                Set<Integer> ticket2 = Arrays.stream(tickets.get(j)).boxed().collect(Collectors.toSet());
                
                Set<Integer> intersection = new HashSet<>(ticket1);
                intersection.retainAll(ticket2);
                
                double overlapPercentage = ((double) intersection.size() / ticket1.size()) * 100;
                totalOverlap += overlapPercentage;
                comparisons++;
            }
        }
        
        return comparisons > 0 ? totalOverlap / comparisons : 0;
    }
    
    private QualityMetrics createEmptyQualityMetrics(String lotteryConfigId) {
        ImprovementMetrics emptyImprovement = new ImprovementMetrics(0.0, 0.0, 0.0, false, "unknown");
        return new QualityMetrics(0.0, "F", 
                Map.of("HOT", 0.0, "WARM", 0.0, "COLD", 0.0, "UNKNOWN", 0.0),
                0.0, 0.0, 0.0, 0.0, 0.0, 0, lotteryConfigId, emptyImprovement);
    }
    
    /**
     * Inner helper classes for organizing metrics
     */
    private static class NumberAnalysisMetrics {
        private final double hotNumberCoverage;
        private final Map<String, Double> numberDistribution;
        private final double consecutiveNumberRate;
        private final double provenCombinationUsage;
        
        public NumberAnalysisMetrics(double hotNumberCoverage, Map<String, Double> numberDistribution, 
                                   double consecutiveNumberRate, double provenCombinationUsage) {
            this.hotNumberCoverage = hotNumberCoverage;
            this.numberDistribution = numberDistribution;
            this.consecutiveNumberRate = consecutiveNumberRate;
            this.provenCombinationUsage = provenCombinationUsage;
        }
        
        public double getHotNumberCoverage() { return hotNumberCoverage; }
        public Map<String, Double> getNumberDistribution() { return numberDistribution; }
        public double getConsecutiveNumberRate() { return consecutiveNumberRate; }
        public double getProvenCombinationUsage() { return provenCombinationUsage; }
    }
    
    private static class DiversityMetrics {
        private final int uniqueNumbers;
        private final double averageOverlap;
        
        public DiversityMetrics(int uniqueNumbers, double averageOverlap) {
            this.uniqueNumbers = uniqueNumbers;
            this.averageOverlap = averageOverlap;
        }
        
        public int getUniqueNumbers() { return uniqueNumbers; }
        public double getAverageOverlap() { return averageOverlap; }
    }
}