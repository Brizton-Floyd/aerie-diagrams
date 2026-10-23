package com.floyd.lottoptions.legacy.desktop.quality;

import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateGroup;
import com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical.TemplateMatrixLotteryNumberGenerator;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Represents user preferences for lottery ticket generation and quality evaluation.
 * Contains constraints, preferred numbers, and quality thresholds that guide
 * the ticket generation and evaluation process.
 */
public class UserPreferences {
    
    private boolean avoidConsecutive;
    private List<Integer> preferredNumbers;
    private List<Integer> excludeNumbers;
    private int minHotPatterns;
    private int maxColdPatterns;
    private double targetCoveragePercentage;
    private double minQualityScore;
    private boolean preferBalancedDistribution;
    
    // Multi-batch generation preferences
    private boolean enableMultiBatch;
    private int maxBatchVariance;
    private boolean preventDuplicates;
    
    // TemplateMatrix preferences
    private boolean enableTemplateMatrix;
    private TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy templateSelectionStrategy;
    private Set<TemplateGroup> allowedTemplateGroups;
    private boolean useTimingIndicators;
    private boolean considerOverdueTemplates;
    private double minimumTemplateProbability;
    private int numberSetsPerTemplate;
    
    // Delta-specific preferences
    private boolean enableDeltaStrategy;
    private String deltaPatternPreference;
    private double deltaQualityThreshold;
    private boolean enableDroughtIntelligence;
    private boolean enableTierOptimization;
    private int deltaVariationCount;
    private String deltaComplexityLevel;
    private boolean excludePreviousWinners;

    /**
     * Constructs UserPreferences with default values.
     */
    public UserPreferences() {
        this.avoidConsecutive = false;
        this.preferredNumbers = new ArrayList<>();
        this.excludeNumbers = new ArrayList<>();
        this.minHotPatterns = 0;
        this.maxColdPatterns = 10;
        this.targetCoveragePercentage = 60.0;
        this.minQualityScore = 50.0;
        this.preferBalancedDistribution = true;
        this.enableMultiBatch = true; // Enable multi-batch by default for large requests
        this.maxBatchVariance = 3; // Allow up to 3 different batch parameter sets
        this.preventDuplicates = true; // Always prevent duplicates
        
        // Initialize TemplateMatrix preferences with defaults
        this.enableTemplateMatrix = false; // Disabled by default for backward compatibility
        this.templateSelectionStrategy = TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy.BALANCED;
        this.allowedTemplateGroups = EnumSet.of(TemplateGroup.BEST, TemplateGroup.GOOD);
        this.useTimingIndicators = true;
        this.considerOverdueTemplates = true;
        this.minimumTemplateProbability = 0.01; // 1% minimum probability
        this.numberSetsPerTemplate = 5;
        
        // Initialize Delta preferences with defaults
        this.enableDeltaStrategy = false; // Disabled by default for backward compatibility
        this.deltaPatternPreference = "BALANCED"; // BALANCED, AGGRESSIVE, CONSERVATIVE, CUSTOM
        this.deltaQualityThreshold = 0.7; // 70% quality threshold for delta patterns
        this.enableDroughtIntelligence = true; // Enable drought analysis when delta is enabled
        this.enableTierOptimization = true; // Enable tier optimization when delta is enabled
        this.deltaVariationCount = 10; // Default number of pattern variations to generate
        this.deltaComplexityLevel = "MEDIUM"; // LOW, MEDIUM, HIGH complexity for pattern selection
        this.excludePreviousWinners = false; // By default, don't exclude previous winners (maintain math purity)
    }

    /**
     * Gets whether to avoid consecutive numbers.
     *
     * @return true if consecutive numbers should be avoided
     */
    public boolean isAvoidConsecutive() {
        return avoidConsecutive;
    }

    /**
     * Sets whether to avoid consecutive numbers.
     *
     * @param avoidConsecutive true to avoid consecutive numbers
     */
    public void setAvoidConsecutive(boolean avoidConsecutive) {
        this.avoidConsecutive = avoidConsecutive;
    }

    /**
     * Gets the list of preferred numbers.
     *
     * @return List of preferred numbers
     */
    public List<Integer> getPreferredNumbers() {
        return preferredNumbers;
    }

    /**
     * Sets the list of preferred numbers.
     *
     * @param preferredNumbers List of numbers to prefer in generation
     */
    public void setPreferredNumbers(List<Integer> preferredNumbers) {
        this.preferredNumbers = preferredNumbers != null ? preferredNumbers : new ArrayList<>();
    }

    /**
     * Gets the list of numbers to exclude.
     *
     * @return List of excluded numbers
     */
    public List<Integer> getExcludeNumbers() {
        return excludeNumbers;
    }

    /**
     * Sets the list of numbers to exclude.
     *
     * @param excludeNumbers List of numbers to exclude from generation
     */
    public void setExcludeNumbers(List<Integer> excludeNumbers) {
        this.excludeNumbers = excludeNumbers != null ? excludeNumbers : new ArrayList<>();
    }

    /**
     * Gets the minimum number of HOT patterns required.
     *
     * @return Minimum HOT patterns
     */
    public int getMinHotPatterns() {
        return minHotPatterns;
    }

    /**
     * Sets the minimum number of HOT patterns required.
     *
     * @param minHotPatterns Minimum HOT patterns (0 or more)
     */
    public void setMinHotPatterns(int minHotPatterns) {
        this.minHotPatterns = Math.max(0, minHotPatterns);
    }

    /**
     * Gets the maximum number of COLD patterns allowed.
     *
     * @return Maximum COLD patterns
     */
    public int getMaxColdPatterns() {
        return maxColdPatterns;
    }

    /**
     * Sets the maximum number of COLD patterns allowed.
     *
     * @param maxColdPatterns Maximum COLD patterns (0 or more)
     */
    public void setMaxColdPatterns(int maxColdPatterns) {
        this.maxColdPatterns = Math.max(0, maxColdPatterns);
    }

    /**
     * Gets the target coverage percentage.
     *
     * @return Target coverage percentage (0-100)
     */
    public double getTargetCoveragePercentage() {
        return targetCoveragePercentage;
    }

    /**
     * Sets the target coverage percentage.
     *
     * @param targetCoveragePercentage Target coverage (0-100)
     */
    public void setTargetCoveragePercentage(double targetCoveragePercentage) {
        this.targetCoveragePercentage = Math.max(0.0, Math.min(100.0, targetCoveragePercentage));
    }

    /**
     * Gets the minimum quality score threshold.
     *
     * @return Minimum quality score (0-100)
     */
    public double getMinQualityScore() {
        return minQualityScore;
    }

    /**
     * Sets the minimum quality score threshold.
     *
     * @param minQualityScore Minimum quality score (0-100)
     */
    public void setMinQualityScore(double minQualityScore) {
        this.minQualityScore = Math.max(0.0, Math.min(100.0, minQualityScore));
    }

    /**
     * Gets whether balanced pattern distribution is preferred.
     *
     * @return true if balanced distribution is preferred
     */
    public boolean isPreferBalancedDistribution() {
        return preferBalancedDistribution;
    }

    /**
     * Sets whether balanced pattern distribution is preferred.
     *
     * @param preferBalancedDistribution true to prefer balanced distribution
     */
    public void setPreferBalancedDistribution(boolean preferBalancedDistribution) {
        this.preferBalancedDistribution = preferBalancedDistribution;
    }

    /**
     * Gets whether multi-batch generation is enabled.
     *
     * @return true if multi-batch generation should be used for large requests
     */
    public boolean isEnableMultiBatch() {
        return enableMultiBatch;
    }

    /**
     * Sets whether multi-batch generation is enabled.
     *
     * @param enableMultiBatch true to enable multi-batch for large requests
     */
    public void setEnableMultiBatch(boolean enableMultiBatch) {
        this.enableMultiBatch = enableMultiBatch;
    }

    /**
     * Gets the maximum batch variance level.
     *
     * @return Maximum number of different parameter sets for batch variance
     */
    public int getMaxBatchVariance() {
        return maxBatchVariance;
    }

    /**
     * Sets the maximum batch variance level.
     *
     * @param maxBatchVariance Maximum variance level (1-5 recommended)
     */
    public void setMaxBatchVariance(int maxBatchVariance) {
        this.maxBatchVariance = Math.max(1, Math.min(5, maxBatchVariance));
    }

    /**
     * Gets whether duplicate prevention is enabled.
     *
     * @return true if duplicates should be prevented across batches
     */
    public boolean isPreventDuplicates() {
        return preventDuplicates;
    }

    /**
     * Sets whether duplicate prevention is enabled.
     *
     * @param preventDuplicates true to prevent duplicate tickets
     */
    public void setPreventDuplicates(boolean preventDuplicates) {
        this.preventDuplicates = preventDuplicates;
    }
    
    // TemplateMatrix preference getters and setters
    
    /**
     * Gets whether TemplateMatrix generation is enabled.
     *
     * @return true if TemplateMatrix generation should be used
     */
    public boolean isEnableTemplateMatrix() {
        return enableTemplateMatrix;
    }
    
    /**
     * Sets whether TemplateMatrix generation is enabled.
     *
     * @param enableTemplateMatrix true to enable TemplateMatrix generation
     */
    public void setEnableTemplateMatrix(boolean enableTemplateMatrix) {
        this.enableTemplateMatrix = enableTemplateMatrix;
    }
    
    /**
     * Gets the template selection strategy.
     *
     * @return The template selection strategy
     */
    public TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy getTemplateSelectionStrategy() {
        return templateSelectionStrategy;
    }
    
    /**
     * Sets the template selection strategy.
     *
     * @param templateSelectionStrategy The strategy to use for template selection
     */
    public void setTemplateSelectionStrategy(TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy templateSelectionStrategy) {
        this.templateSelectionStrategy = templateSelectionStrategy;
    }
    
    /**
     * Gets the allowed template groups.
     *
     * @return Set of allowed template groups
     */
    public Set<TemplateGroup> getAllowedTemplateGroups() {
        return allowedTemplateGroups;
    }
    
    /**
     * Sets the allowed template groups.
     *
     * @param allowedTemplateGroups Set of template groups to allow
     */
    public void setAllowedTemplateGroups(Set<TemplateGroup> allowedTemplateGroups) {
        System.out.println("DEBUG UserPreferences: setAllowedTemplateGroups called with: " + allowedTemplateGroups);
        this.allowedTemplateGroups = allowedTemplateGroups != null ? allowedTemplateGroups : EnumSet.noneOf(TemplateGroup.class);
        System.out.println("DEBUG UserPreferences: allowedTemplateGroups set to: " + this.allowedTemplateGroups);
    }
    
    /**
     * Gets whether timing indicators should be used.
     *
     * @return true if timing indicators should be considered
     */
    public boolean isUseTimingIndicators() {
        return useTimingIndicators;
    }
    
    /**
     * Sets whether timing indicators should be used.
     *
     * @param useTimingIndicators true to use timing indicators
     */
    public void setUseTimingIndicators(boolean useTimingIndicators) {
        this.useTimingIndicators = useTimingIndicators;
    }
    
    /**
     * Gets whether overdue templates should be considered.
     *
     * @return true if overdue templates should be prioritized
     */
    public boolean isConsiderOverdueTemplates() {
        return considerOverdueTemplates;
    }
    
    /**
     * Sets whether overdue templates should be considered.
     *
     * @param considerOverdueTemplates true to consider overdue templates
     */
    public void setConsiderOverdueTemplates(boolean considerOverdueTemplates) {
        this.considerOverdueTemplates = considerOverdueTemplates;
    }
    
    /**
     * Gets the minimum template probability threshold.
     *
     * @return Minimum probability (0-1) for template selection
     */
    public double getMinimumTemplateProbability() {
        return minimumTemplateProbability;
    }
    
    /**
     * Sets the minimum template probability threshold.
     *
     * @param minimumTemplateProbability Minimum probability (0-1) for template selection
     */
    public void setMinimumTemplateProbability(double minimumTemplateProbability) {
        this.minimumTemplateProbability = Math.max(0.0, Math.min(1.0, minimumTemplateProbability));
    }
    
    /**
     * Gets the number of number sets to generate per template.
     *
     * @return Number of sets per template
     */
    public int getNumberSetsPerTemplate() {
        return numberSetsPerTemplate;
    }
    
    /**
     * Sets the number of number sets to generate per template.
     *
     * @param numberSetsPerTemplate Number of sets per template (1 or more)
     */
    public void setNumberSetsPerTemplate(int numberSetsPerTemplate) {
        this.numberSetsPerTemplate = Math.max(1, numberSetsPerTemplate);
    }
    
    // Delta-specific preference getters and setters
    
    /**
     * Gets whether Delta strategy generation is enabled.
     *
     * @return true if Delta strategy should be used
     */
    public boolean isEnableDeltaStrategy() {
        return enableDeltaStrategy;
    }
    
    /**
     * Sets whether Delta strategy generation is enabled.
     *
     * @param enableDeltaStrategy true to enable Delta strategy generation
     */
    public void setEnableDeltaStrategy(boolean enableDeltaStrategy) {
        this.enableDeltaStrategy = enableDeltaStrategy;
    }
    
    /**
     * Gets the delta pattern preference.
     *
     * @return The delta pattern preference (BALANCED, AGGRESSIVE, CONSERVATIVE, CUSTOM)
     */
    public String getDeltaPatternPreference() {
        return deltaPatternPreference;
    }
    
    /**
     * Sets the delta pattern preference.
     *
     * @param deltaPatternPreference The pattern preference to use
     */
    public void setDeltaPatternPreference(String deltaPatternPreference) {
        this.deltaPatternPreference = deltaPatternPreference != null ? deltaPatternPreference : "BALANCED";
    }
    
    /**
     * Gets the delta quality threshold.
     *
     * @return Quality threshold (0.0-1.0) for delta pattern generation
     */
    public double getDeltaQualityThreshold() {
        return deltaQualityThreshold;
    }
    
    /**
     * Sets the delta quality threshold.
     *
     * @param deltaQualityThreshold Quality threshold (0.0-1.0) for delta patterns
     */
    public void setDeltaQualityThreshold(double deltaQualityThreshold) {
        this.deltaQualityThreshold = Math.max(0.0, Math.min(1.0, deltaQualityThreshold));
    }
    
    /**
     * Gets whether drought intelligence is enabled for delta generation.
     *
     * @return true if drought analysis should be applied to delta patterns
     */
    public boolean isEnableDroughtIntelligence() {
        return enableDroughtIntelligence;
    }
    
    /**
     * Sets whether drought intelligence is enabled for delta generation.
     *
     * @param enableDroughtIntelligence true to enable drought intelligence
     */
    public void setEnableDroughtIntelligence(boolean enableDroughtIntelligence) {
        this.enableDroughtIntelligence = enableDroughtIntelligence;
    }
    
    /**
     * Gets whether tier optimization is enabled for delta generation.
     *
     * @return true if tier optimization should be applied to delta patterns
     */
    public boolean isEnableTierOptimization() {
        return enableTierOptimization;
    }
    
    /**
     * Sets whether tier optimization is enabled for delta generation.
     *
     * @param enableTierOptimization true to enable tier optimization
     */
    public void setEnableTierOptimization(boolean enableTierOptimization) {
        this.enableTierOptimization = enableTierOptimization;
    }
    
    /**
     * Gets the delta variation count.
     *
     * @return Number of pattern variations to generate for delta strategy
     */
    public int getDeltaVariationCount() {
        return deltaVariationCount;
    }
    
    /**
     * Sets the delta variation count.
     *
     * @param deltaVariationCount Number of variations to generate (1 or more)
     */
    public void setDeltaVariationCount(int deltaVariationCount) {
        this.deltaVariationCount = Math.max(1, deltaVariationCount);
    }
    
    /**
     * Gets the delta complexity level.
     *
     * @return Complexity level (LOW, MEDIUM, HIGH) for pattern selection
     */
    public String getDeltaComplexityLevel() {
        return deltaComplexityLevel;
    }
    
    /**
     * Sets the delta complexity level.
     *
     * @param deltaComplexityLevel Complexity level for pattern selection
     */
    public void setDeltaComplexityLevel(String deltaComplexityLevel) {
        this.deltaComplexityLevel = deltaComplexityLevel != null ? deltaComplexityLevel : "MEDIUM";
    }
    
    /**
     * Gets whether to exclude previous jackpot winning combinations.
     * 
     * @return true if previous winners should be filtered out
     */
    public boolean isExcludePreviousWinners() {
        return excludePreviousWinners;
    }
    
    /**
     * Sets whether to exclude previous jackpot winning combinations.
     * When enabled, any generated tickets that match historical jackpot winners
     * will be filtered out and replaced with alternative patterns.
     * 
     * @param excludePreviousWinners true to exclude previous winners
     */
    public void setExcludePreviousWinners(boolean excludePreviousWinners) {
        this.excludePreviousWinners = excludePreviousWinners;
    }

    /**
     * Adds a preferred number.
     *
     * @param number The number to add to preferences
     */
    public void addPreferredNumber(int number) {
        if (!preferredNumbers.contains(number)) {
            preferredNumbers.add(number);
        }
    }

    /**
     * Adds an excluded number.
     *
     * @param number The number to exclude
     */
    public void addExcludedNumber(int number) {
        if (!excludeNumbers.contains(number)) {
            excludeNumbers.add(number);
        }
    }

    /**
     * Removes a preferred number.
     *
     * @param number The number to remove from preferences
     */
    public void removePreferredNumber(int number) {
        preferredNumbers.remove(Integer.valueOf(number));
    }

    /**
     * Removes an excluded number.
     *
     * @param number The number to remove from exclusions
     */
    public void removeExcludedNumber(int number) {
        excludeNumbers.remove(Integer.valueOf(number));
    }

    /**
     * Checks if preferences are valid and consistent.
     *
     * @return true if preferences are valid
     */
    public boolean isValid() {
        // Check for overlap between preferred and excluded numbers
        for (Integer preferred : preferredNumbers) {
            if (excludeNumbers.contains(preferred)) {
                return false;
            }
        }
        
        // Check reasonable ranges
        return minQualityScore >= 0 && minQualityScore <= 100 &&
               targetCoveragePercentage >= 0 && targetCoveragePercentage <= 100 &&
               minHotPatterns >= 0 && maxColdPatterns >= 0;
    }

    /**
     * Creates a copy of these preferences.
     *
     * @return A new UserPreferences instance with the same values
     */
    public UserPreferences copy() {
        UserPreferences copy = new UserPreferences();
        copy.setAvoidConsecutive(this.avoidConsecutive);
        copy.setPreferredNumbers(new ArrayList<>(this.preferredNumbers));
        copy.setExcludeNumbers(new ArrayList<>(this.excludeNumbers));
        copy.setMinHotPatterns(this.minHotPatterns);
        copy.setMaxColdPatterns(this.maxColdPatterns);
        copy.setTargetCoveragePercentage(this.targetCoveragePercentage);
        copy.setMinQualityScore(this.minQualityScore);
        copy.setPreferBalancedDistribution(this.preferBalancedDistribution);
        copy.setEnableMultiBatch(this.enableMultiBatch);
        copy.setMaxBatchVariance(this.maxBatchVariance);
        copy.setPreventDuplicates(this.preventDuplicates);
        
        // Copy TemplateMatrix preferences
        copy.setEnableTemplateMatrix(this.enableTemplateMatrix);
        copy.setTemplateSelectionStrategy(this.templateSelectionStrategy);
        copy.setAllowedTemplateGroups(this.allowedTemplateGroups != null ? EnumSet.copyOf(this.allowedTemplateGroups) : EnumSet.noneOf(TemplateGroup.class));
        copy.setUseTimingIndicators(this.useTimingIndicators);
        copy.setConsiderOverdueTemplates(this.considerOverdueTemplates);
        copy.setMinimumTemplateProbability(this.minimumTemplateProbability);
        copy.setNumberSetsPerTemplate(this.numberSetsPerTemplate);
        
        // Copy Delta preferences
        copy.setEnableDeltaStrategy(this.enableDeltaStrategy);
        copy.setDeltaPatternPreference(this.deltaPatternPreference);
        copy.setDeltaQualityThreshold(this.deltaQualityThreshold);
        copy.setEnableDroughtIntelligence(this.enableDroughtIntelligence);
        copy.setEnableTierOptimization(this.enableTierOptimization);
        copy.setDeltaVariationCount(this.deltaVariationCount);
        copy.setDeltaComplexityLevel(this.deltaComplexityLevel);
        
        return copy;
    }

    @Override
    public String toString() {
        return String.format("UserPreferences{consecutive=%b, preferred=%d, excluded=%d, minHot=%d, maxCold=%d, coverage=%.1f%%, minScore=%.1f, multiBatch=%b, variance=%d, preventDup=%b, templateMatrix=%b, strategy=%s, groups=%d, delta=%b, deltaPattern=%s, deltaQuality=%.2f, drought=%b, tier=%b, variations=%d, complexity=%s}",
                avoidConsecutive, preferredNumbers.size(), excludeNumbers.size(), 
                minHotPatterns, maxColdPatterns, targetCoveragePercentage, minQualityScore,
                enableMultiBatch, maxBatchVariance, preventDuplicates,
                enableTemplateMatrix, templateSelectionStrategy, 
                allowedTemplateGroups != null ? allowedTemplateGroups.size() : 0,
                enableDeltaStrategy, deltaPatternPreference, deltaQualityThreshold,
                enableDroughtIntelligence, enableTierOptimization, deltaVariationCount, deltaComplexityLevel);
    }
}