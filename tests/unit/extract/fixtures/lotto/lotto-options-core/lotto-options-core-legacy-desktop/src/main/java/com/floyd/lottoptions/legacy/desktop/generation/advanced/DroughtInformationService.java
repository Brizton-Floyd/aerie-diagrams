package com.floyd.lottoptions.legacy.desktop.generation.advanced;

import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeDroughtAnalysis;
import com.floyd.lottoptions.legacy.desktop.generation.drought.PrizeTierDrought;
import com.floyd.lottoptions.legacy.desktop.generation.performance.PatternPerformanceAnalysis;
import com.floyd.lottoptions.legacy.desktop.util.NumberFormatter;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for translating drought analysis results into UI-friendly information
 * that helps users understand current drought conditions and strategic recommendations.
 */
public class DroughtInformationService {
    
    /**
     * Creates comprehensive drought information for UI display.
     */
    public static DroughtInformation createDroughtInformation(
            PrizeDroughtAnalysis droughtAnalysis,
            PatternPerformanceAnalysis patternAnalysis,
            String userTargetTier) {
        return createDroughtInformation(droughtAnalysis, patternAnalysis, userTargetTier, null);
    }
    
    /**
     * Creates comprehensive drought information for UI display with game context.
     */
    public static DroughtInformation createDroughtInformation(
            PrizeDroughtAnalysis droughtAnalysis,
            PatternPerformanceAnalysis patternAnalysis,
            String userTargetTier,
            Integer gameDrawPositions) {
        
        if (droughtAnalysis == null) {
            return DroughtInformation.noData();
        }
        
        // Convert internal format to user-friendly format
        String friendlyTargetTier = convertToFriendlyFormat(userTargetTier, gameDrawPositions);
        
        // Analyze drought status
        DroughtStatus overallStatus = calculateOverallDroughtStatus(droughtAnalysis);
        List<TierDroughtInfo> tierInfo = createTierInformation(droughtAnalysis, gameDrawPositions);
        
        // Strategic recommendations
        List<String> recommendations = generateRecommendations(droughtAnalysis, patternAnalysis, userTargetTier);
        
        // Advanced generation readiness
        boolean advancedGenerationReady = isAdvancedGenerationReady(droughtAnalysis, patternAnalysis);
        String generationStrategy = determineRecommendedStrategy(droughtAnalysis, patternAnalysis, userTargetTier);
        
        return new DroughtInformation(
            overallStatus,
            droughtAnalysis.getOverallDroughtScore(),
            friendlyTargetTier,
            isTargetTierInDrought(droughtAnalysis, userTargetTier),
            tierInfo,
            recommendations,
            advancedGenerationReady,
            generationStrategy,
            droughtAnalysis.getAnalysisDate(),
            droughtAnalysis.getStrategicRecommendations()
        );
    }
    
    /**
     * Converts between different tier format conventions.
     */
    private static String convertToFriendlyFormat(String tier) {
        return convertToFriendlyFormat(tier, null);
    }
    
    /**
     * Converts between different tier format conventions with game context.
     */
    private static String convertToFriendlyFormat(String tier, Integer gameDrawPositions) {
        if (tier == null) return "Unknown";
        
        // Already in friendly format
        if (tier.contains("-of-")) {
            return tier;
        }
        
        // Default to 6 if no game context provided
        int totalNumbers = gameDrawPositions != null ? gameDrawPositions : 6;
        
        // Convert from internal match format
        switch (tier.toLowerCase()) {
            case "match3": return "3-of-" + totalNumbers;
            case "match4": return "4-of-" + totalNumbers;
            case "match5": 
                // For 5-draw games, match5 IS the jackpot
                if (totalNumbers == 5) {
                    return "5-of-5 (Jackpot)";
                } else {
                    return "5-of-" + totalNumbers;
                }
            case "match6": 
                // For 6-draw games, match6 IS the jackpot
                if (totalNumbers == 6) {
                    return "6-of-6 (Jackpot)";
                } else {
                    return "6-of-" + totalNumbers;
                }
            case "jackpot": return totalNumbers + "-of-" + totalNumbers + " (Jackpot)";
            case "tier_1": return totalNumbers + "-of-" + totalNumbers + " (Tier 1)";
            case "tier_2": return Math.max(3, totalNumbers-1) + "-of-" + totalNumbers + " (Tier 2)";
            case "tier_3": return Math.max(3, totalNumbers-2) + "-of-" + totalNumbers + " (Tier 3)";
            case "tier_4": return "3-of-" + totalNumbers + " (Tier 4)";
            case "tier_5": return "2-of-" + totalNumbers + " (Tier 5)";
            default: return tier;
        }
    }
    
    /**
     * Converts user-friendly format to internal match format for analysis.
     */
    public static String convertToInternalFormat(String friendlyTier) {
        if (friendlyTier == null) return "match4";
        
        String lower = friendlyTier.toLowerCase();
        
        if (lower.contains("6-of-6") || lower.contains("jackpot")) {
            return "jackpot";
        } else if (lower.contains("5-of-6") || lower.contains("5-of-5")) {
            return "match5";
        } else if (lower.contains("4-of-6") || lower.contains("4-of-5")) {
            return "match4";
        } else if (lower.contains("3-of-6") || lower.contains("3-of-5")) {
            return "match3";
        } else if (lower.contains("tier_1") || lower.equals("1")) {
            return "jackpot";
        } else if (lower.contains("tier_2") || lower.equals("2")) {
            return "match5";
        } else if (lower.contains("tier_3") || lower.equals("3")) {
            return "match4";
        } else if (lower.contains("tier_4") || lower.equals("4")) {
            return "match3";
        }
        
        return "match4"; // Default fallback
    }
    
    /**
     * Calculates overall drought status based on active droughts.
     */
    private static DroughtStatus calculateOverallDroughtStatus(PrizeDroughtAnalysis analysis) {
        if (!analysis.hasActiveDroughts()) {
            return DroughtStatus.NORMAL;
        }
        
        double droughtScore = analysis.getOverallDroughtScore();
        
        if (droughtScore >= 3.0) {
            return DroughtStatus.CRITICAL;
        } else if (droughtScore >= 2.0) {
            return DroughtStatus.HIGH;
        } else if (droughtScore >= 1.5) {
            return DroughtStatus.MODERATE;
        } else {
            return DroughtStatus.LOW;
        }
    }
    
    /**
     * Creates detailed information about each tier's drought status.
     */
    private static List<TierDroughtInfo> createTierInformation(PrizeDroughtAnalysis analysis) {
        return createTierInformation(analysis, null);
    }
    
    /**
     * Creates detailed information about each tier's drought status with game context.
     */
    private static List<TierDroughtInfo> createTierInformation(PrizeDroughtAnalysis analysis, Integer gameDrawPositions) {
        List<TierDroughtInfo> tierInfo = new ArrayList<>();
        
        // Get drought information for all tiers
        Map<String, PrizeTierDrought> droughts = analysis.getPrizeTierDroughts();
        
        for (Map.Entry<String, PrizeTierDrought> entry : droughts.entrySet()) {
            String tier = entry.getKey();
            PrizeTierDrought drought = entry.getValue();
            
            // Skip jackpot tier when match5/match6 handles it
            if (gameDrawPositions != null && "jackpot".equals(tier)) {
                if ((gameDrawPositions == 5) || (gameDrawPositions == 6)) {
                    continue; // match5 handles 5-draw jackpot, match6 handles 6-draw jackpot
                }
            }
            
            String friendlyTier = convertToFriendlyFormat(tier, gameDrawPositions);
            boolean isInDrought = drought.isInDrought();
            int daysSinceLastWin = drought.getDaysSinceLastOccurrence();
            double severity = drought.getDroughtSeverity();
            
            TierDroughtSeverity droughtSeverity;
            
            // Apply more aggressive drought detection based on actual days
            boolean actuallyInDrought = isActuallyInDrought(tier, daysSinceLastWin, severity);
            double adjustedSeverity = calculateAdjustedSeverity(tier, daysSinceLastWin, severity);
            
            if (!actuallyInDrought) {
                droughtSeverity = TierDroughtSeverity.NORMAL;
            } else if (adjustedSeverity >= 3.0 || daysSinceLastWin > 1000) {
                droughtSeverity = TierDroughtSeverity.CRITICAL;
            } else if (adjustedSeverity >= 2.0 || daysSinceLastWin > 200) {
                droughtSeverity = TierDroughtSeverity.HIGH;
            } else if (adjustedSeverity >= 1.5 || daysSinceLastWin > 100) {
                droughtSeverity = TierDroughtSeverity.MODERATE;
            } else {
                droughtSeverity = TierDroughtSeverity.NORMAL;
            }
            
            // Override isInDrought with our more aggressive detection
            isInDrought = actuallyInDrought;
            
            // Get expectancy data for critical tiers
            Double expectedDays = null;
            Double actualVsExpected = null;
            if (droughtSeverity == TierDroughtSeverity.CRITICAL || droughtSeverity == TierDroughtSeverity.HIGH) {
                expectedDays = drought.getExpectedDays();
                if (expectedDays > 0) {
                    actualVsExpected = daysSinceLastWin / expectedDays;
                }
            }
            
            tierInfo.add(new TierDroughtInfo(
                tier, 
                friendlyTier, 
                isInDrought,
                daysSinceLastWin,
                severity,
                droughtSeverity,
                generateTierRecommendation(tier, drought),
                expectedDays,
                actualVsExpected
            ));
        }
        
        // Sort by severity (most severe first)
        tierInfo.sort((a, b) -> Double.compare(b.getSeverity(), a.getSeverity()));
        
        return tierInfo;
    }
    
    /**
     * Checks if the user's target tier is currently in drought.
     */
    private static boolean isTargetTierInDrought(PrizeDroughtAnalysis analysis, String userTargetTier) {
        String internalTier = convertToInternalFormat(userTargetTier);
        Map<String, PrizeTierDrought> droughts = analysis.getPrizeTierDroughts();
        
        PrizeTierDrought targetDrought = droughts.get(internalTier);
        return targetDrought != null && targetDrought.isInDrought();
    }
    
    /**
     * Generates strategic recommendations based on drought and pattern analysis.
     */
    private static List<String> generateRecommendations(
            PrizeDroughtAnalysis droughtAnalysis,
            PatternPerformanceAnalysis patternAnalysis,
            String userTargetTier) {
        
        List<String> recommendations = new ArrayList<>();
        
        // Drought-based recommendations
        if (droughtAnalysis.hasActiveDroughts()) {
            String highestPriorityTier = droughtAnalysis.getHighestPriorityPrizeTier();
            String friendlyTier = convertToFriendlyFormat(highestPriorityTier);
            double droughtWeight = droughtAnalysis.getTargetingWeight(highestPriorityTier);
            
            if (isTargetTierInDrought(droughtAnalysis, userTargetTier)) {
                recommendations.add("🎯 Your target tier (" + convertToFriendlyFormat(userTargetTier) + 
                    ") is currently in drought - great timing for focused generation!");
            }
            
            recommendations.add("🔥 Highest priority drought: " + friendlyTier + 
                " (targeting weight: " + String.format("%.1fx", droughtWeight) + ")");
            
            if (droughtAnalysis.getOverallDroughtScore() >= 2.5) {
                recommendations.add("⚡ Multiple severe droughts detected - consider using advanced generation strategies");
            }
        }
        
        // Pattern-based recommendations
        if (patternAnalysis != null && patternAnalysis.hasSignificantData()) {
            List<String> bestPatterns = patternAnalysis.getHighestSuccessRatePatterns(3);
            if (!bestPatterns.isEmpty()) {
                recommendations.add("📊 " + bestPatterns.size() + " high-success patterns identified for enhanced generation");
            }
            
            Map<String, Double> successRates = patternAnalysis.getPatternSuccessRates();
            double topSuccessRate = successRates.values().stream()
                .mapToDouble(Double::doubleValue)
                .max().orElse(0.0);
            
            if (topSuccessRate > 0.6) {
                recommendations.add("🚀 Exceptional pattern performance detected (up to " + 
                    String.format("%.1f%%", topSuccessRate * 100) + " success rate)");
            }
        }
        
        // Combined strategy recommendations
        boolean hasActiveDroughts = droughtAnalysis.hasActiveDroughts();
        boolean hasPatternData = patternAnalysis != null && patternAnalysis.hasSignificantData();
        
        if (hasActiveDroughts && hasPatternData) {
            recommendations.add("🎊 Phase 3 Advanced Generation recommended - combining drought analysis + pattern intelligence");
        } else if (hasActiveDroughts) {
            recommendations.add("🎯 Drought-focused generation recommended based on current conditions");
        } else if (hasPatternData) {
            recommendations.add("📈 Pattern-focused generation recommended based on historical performance");
        }
        
        return recommendations;
    }
    
    /**
     * Generates specific recommendation for a tier drought.
     */
    private static String generateTierRecommendation(String tier, PrizeTierDrought drought) {
        if (!drought.isInDrought()) {
            return "Normal frequency - no special targeting needed";
        }
        
        double severity = drought.getDroughtSeverity();
        int days = drought.getDaysSinceLastOccurrence();
        
        if (severity >= 3.0) {
            return String.format("CRITICAL: %d days overdue - highest priority for targeting", days);
        } else if (severity >= 2.0) {
            return String.format("HIGH: %d days overdue - excellent targeting opportunity", days);
        } else {
            return String.format("MODERATE: %d days overdue - consider for targeting", days);
        }
    }
    
    /**
     * Determines if advanced generation is ready based on available intelligence.
     */
    private static boolean isAdvancedGenerationReady(
            PrizeDroughtAnalysis droughtAnalysis,
            PatternPerformanceAnalysis patternAnalysis) {
        
        boolean hasDroughts = droughtAnalysis.hasActiveDroughts();
        boolean hasPatterns = patternAnalysis != null && patternAnalysis.hasSignificantData();
        
        // Advanced generation is ready if we have either drought or pattern intelligence
        return hasDroughts || hasPatterns;
    }
    
    /**
     * Determines the recommended generation strategy.
     */
    private static String determineRecommendedStrategy(
            PrizeDroughtAnalysis droughtAnalysis,
            PatternPerformanceAnalysis patternAnalysis,
            String userTargetTier) {
        
        boolean hasDroughts = droughtAnalysis.hasActiveDroughts();
        boolean hasPatterns = patternAnalysis != null && patternAnalysis.hasSignificantData();
        
        if (hasDroughts && hasPatterns) {
            return "Combined Intelligence (Drought + Pattern Analysis)";
        } else if (hasDroughts) {
            return "Drought-Focused Generation";
        } else if (hasPatterns) {
            return "Pattern-Focused Generation";
        } else {
            return "Enhanced Random Generation";
        }
    }
    
    // Data classes for UI communication
    
    public static class DroughtInformation {
        private final DroughtStatus overallStatus;
        private final double overallScore;
        private final String targetTier;
        private final boolean targetTierInDrought;
        private final List<TierDroughtInfo> tierInformation;
        private final List<String> recommendations;
        private final boolean advancedGenerationReady;
        private final String recommendedStrategy;
        private final LocalDate analysisDate;
        private final String strategicRecommendations;
        
        public DroughtInformation(DroughtStatus overallStatus, double overallScore,
                                String targetTier, boolean targetTierInDrought,
                                List<TierDroughtInfo> tierInformation, List<String> recommendations,
                                boolean advancedGenerationReady, String recommendedStrategy,
                                LocalDate analysisDate, String strategicRecommendations) {
            this.overallStatus = overallStatus;
            this.overallScore = overallScore;
            this.targetTier = targetTier;
            this.targetTierInDrought = targetTierInDrought;
            this.tierInformation = tierInformation;
            this.recommendations = recommendations;
            this.advancedGenerationReady = advancedGenerationReady;
            this.recommendedStrategy = recommendedStrategy;
            this.analysisDate = analysisDate;
            this.strategicRecommendations = strategicRecommendations;
        }
        
        public static DroughtInformation noData() {
            return new DroughtInformation(
                DroughtStatus.UNKNOWN, 0.0, "Unknown", false,
                Collections.emptyList(), 
                List.of("No drought analysis data available"),
                false, "Standard Generation", LocalDate.now(),
                "Insufficient data for drought analysis"
            );
        }
        
        // Getters
        public DroughtStatus getOverallStatus() { return overallStatus; }
        public double getOverallScore() { return NumberFormatter.formatToTwoDecimals(overallScore); }
        public String getTargetTier() { return targetTier; }
        public boolean isTargetTierInDrought() { return targetTierInDrought; }
        public List<TierDroughtInfo> getTierInformation() { return tierInformation; }
        public List<String> getRecommendations() { return recommendations; }
        public boolean isAdvancedGenerationReady() { return advancedGenerationReady; }
        public String getRecommendedStrategy() { return recommendedStrategy; }
        public LocalDate getAnalysisDate() { return analysisDate; }
        public String getStrategicRecommendations() { return strategicRecommendations; }
    }
    
    public static class TierDroughtInfo {
        private final String internalTier;
        private final String friendlyTier;
        private final boolean inDrought;
        private final int daysSinceLastWin;
        private final double severity;
        private final TierDroughtSeverity severityLevel;
        private final String recommendation;
        private final Double expectedDays;
        private final Double actualVsExpected;
        
        public TierDroughtInfo(String internalTier, String friendlyTier, boolean inDrought,
                              int daysSinceLastWin, double severity, TierDroughtSeverity severityLevel,
                              String recommendation) {
            this(internalTier, friendlyTier, inDrought, daysSinceLastWin, severity, 
                 severityLevel, recommendation, null, null);
        }
        
        public TierDroughtInfo(String internalTier, String friendlyTier, boolean inDrought,
                              int daysSinceLastWin, double severity, TierDroughtSeverity severityLevel,
                              String recommendation, Double expectedDays, Double actualVsExpected) {
            this.internalTier = internalTier;
            this.friendlyTier = friendlyTier;
            this.inDrought = inDrought;
            this.daysSinceLastWin = daysSinceLastWin;
            this.severity = severity;
            this.severityLevel = severityLevel;
            this.recommendation = recommendation;
            this.expectedDays = expectedDays;
            this.actualVsExpected = actualVsExpected;
        }
        
        // Getters
        public String getInternalTier() { return internalTier; }
        public String getFriendlyTier() { return friendlyTier; }
        public boolean isInDrought() { return inDrought; }
        public int getDaysSinceLastWin() { return daysSinceLastWin; }
        public double getSeverity() { return NumberFormatter.formatToTwoDecimals(severity); }
        public TierDroughtSeverity getSeverityLevel() { return severityLevel; }
        public String getRecommendation() { return recommendation; }
        public Double getExpectedDays() { return NumberFormatter.formatToTwoDecimals(expectedDays); }
        public Double getActualVsExpected() { return NumberFormatter.formatToTwoDecimals(actualVsExpected); }
    }
    
    public enum DroughtStatus {
        NORMAL("Normal - No significant droughts"),
        LOW("Low - Minor droughts detected"),
        MODERATE("Moderate - Some droughts worth targeting"),
        HIGH("High - Significant drought opportunities"),
        CRITICAL("Critical - Multiple severe droughts"),
        UNKNOWN("Unknown - Insufficient data");
        
        private final String description;
        
        DroughtStatus(String description) {
            this.description = description;
        }
        
        public String getDescription() { return description; }
    }
    
    public enum TierDroughtSeverity {
        NORMAL, MODERATE, HIGH, CRITICAL
    }
    
    /**
     * Determines if a prize tier is actually in drought based on realistic thresholds.
     */
    private static boolean isActuallyInDrought(String tier, int daysSinceLastWin, double originalSeverity) {
        // Apply more realistic drought thresholds
        switch (tier.toLowerCase()) {
            case "match3":
                return daysSinceLastWin > 60;  // More than 2 months
            case "match4": 
                return daysSinceLastWin > 90;  // More than 3 months
            case "match5":
                return daysSinceLastWin > 200; // More than 6-7 months 
            case "jackpot":
                return daysSinceLastWin > 365; // More than 1 year
            default:
                return originalSeverity >= 1.5; // Fallback to original logic
        }
    }
    
    /**
     * Calculates adjusted severity score with more reasonable scaling.
     */
    private static double calculateAdjustedSeverity(String tier, int daysSinceLastWin, double originalSeverity) {
        // Create more meaningful severity based on days and tier
        switch (tier.toLowerCase()) {
            case "match3":
                if (daysSinceLastWin > 200) return 3.5; // Critical
                if (daysSinceLastWin > 120) return 2.5; // High
                if (daysSinceLastWin > 60) return 1.5;  // Moderate
                return 0.5; // Normal
                
            case "match4":
                if (daysSinceLastWin > 500) return 3.5; // Critical
                if (daysSinceLastWin > 300) return 2.5; // High  
                if (daysSinceLastWin > 90) return 1.5;  // Moderate
                return 0.5; // Normal
                
            case "match5":
                if (daysSinceLastWin > 2000) return 3.5; // Critical
                if (daysSinceLastWin > 1000) return 2.5; // High
                if (daysSinceLastWin > 200) return 1.5;  // Moderate
                return 0.5; // Normal
                
            case "jackpot":
                if (daysSinceLastWin > 5000) return 3.5; // Critical
                if (daysSinceLastWin > 2000) return 2.5; // High
                if (daysSinceLastWin > 365) return 1.5;  // Moderate
                return 0.5; // Normal
                
            default:
                return Math.max(originalSeverity, daysSinceLastWin / 100.0);
        }
    }
}