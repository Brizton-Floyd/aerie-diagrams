package com.floyd.analyzer.generator.strategy.categorical;

import com.floyd.analyzer.template.*;
import com.floyd.lottoptions.core.domain.draw.Draw;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.generate.RandomSource;
import com.floyd.lottoptions.core.domain.generate.TicketGenerator;
import com.floyd.lottoptions.core.domain.generate.balanced.Pattern;
import com.floyd.lottoptions.core.domain.generate.balanced.PatternGenerator;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Advanced lottery number generator that leverages TemplateMatrix methodology for intelligent 
 * number selection. This generator uses mathematical template analysis to select patterns 
 * with optimal probability distributions and integrates historical performance data for 
 * enhanced decision making.
 * 
 * Key Features:
 * - Uses TemplateMatrix templates for pattern selection
 * - Considers template performance scores and timing indicators
 * - Supports group-based filtering (BEST, GOOD, etc.)
 * - Integrates with historical analysis for overdue patterns
 * - Falls back to the Balanced Spread patterns when template generation fails
 *
 * The field is 1..{@code field().max()} and a ticket has the game's pick count of numbers.
 */
public class TemplateMatrixLotteryNumberGenerator implements TicketGenerator {
    
    private final DrawHistory history;
    private final int maxNumber;
    private final int pickCount;
    private final TemplateMatrixGenerator templateGenerator;
    private final int numberSetsPerTemplate;
    private final TemplateSelectionStrategy selectionStrategy;
    private final List<int[]> generatedNumbers;
    private final RandomSource randomSource;
    
    // Configuration options
    private Set<TemplateGroup> allowedGroups;
    private boolean useTimingIndicators;
    private boolean considerOverduePatterns;
    private double minimumProbabilityThreshold;
    
    // Analysis tracking
    private TemplateMatrixAnalysisResult analysisResult;
    
    // Template correlation tracking
    private final List<TemplateCorrelatedTicket> correlatedTickets;
    
    /**
     * Strategy for selecting which templates to use for generation.
     */
    public enum TemplateSelectionStrategy {
        BEST_ONLY,           // Only use BEST group templates
        BEST_AND_GOOD,       // Use BEST and GOOD group templates
        HIGH_PROBABILITY,    // Top N% by probability regardless of group
        PERFORMANCE_BASED,   // Based on historical performance scores
        TIMING_AWARE,        // Focus on overdue and approaching due templates
        BALANCED             // Balanced selection across all viable templates
    }
    
    /**
     * Constructs a TemplateMatrix-aware generator that draws its randomness from the given source.
     * 
     * @param history The game and its draws, analyzed oldest first
     * @param numberSetsPerTemplate The total number of tickets to generate
     * @param selectionStrategy Strategy for template selection
     * @param randomSource Source of {@link Random} instances used for generation and shuffling
     */
    public TemplateMatrixLotteryNumberGenerator(DrawHistory history,
                                              int numberSetsPerTemplate,
                                              TemplateSelectionStrategy selectionStrategy,
                                              RandomSource randomSource) {
        this.history = Objects.requireNonNull(history, "history");
        this.maxNumber = history.game().field().max();
        this.pickCount = history.game().pickCount();
        this.randomSource = Objects.requireNonNull(randomSource, "randomSource");
        this.numberSetsPerTemplate = numberSetsPerTemplate;
        this.selectionStrategy = selectionStrategy;
        this.templateGenerator = new TemplateMatrixGenerator();
        this.generatedNumbers = new ArrayList<>();
        this.correlatedTickets = new ArrayList<>();
        
        // Default configuration
        this.allowedGroups = EnumSet.of(TemplateGroup.BEST, TemplateGroup.GOOD);
        this.useTimingIndicators = true;
        this.considerOverduePatterns = true;
        this.minimumProbabilityThreshold = 0.01; // 1% minimum probability
    }

    @Override
    public List<int[]> generate() {
        process();
        return new ArrayList<>(generatedNumbers);
    }

    private void process() {
        generatedNumbers.clear();
        correlatedTickets.clear();
        
        try {
            // The numberSetsPerTemplate parameter from the factory is actually the TOTAL count requested
            int totalTicketsRequested = numberSetsPerTemplate;
            
            System.out.println(String.format("TemplateMatrix: Generating %d total tickets", totalTicketsRequested));
            
            // Generate all possible templates for this lottery configuration
            List<TemplateMatrixTemplate> allTemplates = templateGenerator.generateAllTemplates(
                    1, // Assuming number range starts at 1
                    maxNumber,
                    pickCount
            );
            
            // Debug: Check template groups after initial generation
            Map<TemplateGroup, Long> groupsAfterGeneration = allTemplates.stream()
                    .collect(Collectors.groupingBy(TemplateMatrixTemplate::getTemplateGroup, Collectors.counting()));
            System.out.println("Template groups after generation: " + groupsAfterGeneration);
            
            // ALWAYS perform historical analysis to populate hit counts and performance data
            System.out.println("Performing historical analysis on templates...");
            performBasicHistoricalAnalysisOnTemplates(allTemplates);
            
            // Select templates based on strategy
            List<TemplateMatrixTemplate> selectedTemplates = selectTemplates(allTemplates);
            
            // Implement round robin ticket generation for even distribution
            generateTicketsWithRoundRobin(selectedTemplates, totalTicketsRequested);
            
            System.out.println(String.format("TemplateMatrix: Generated %d tickets (requested: %d)", 
                    generatedNumbers.size(), totalTicketsRequested));
            
            // Generate analysis result from the templates used
            this.analysisResult = createAnalysisResult(allTemplates);
            
        } catch (Exception e) {
            System.err.println("Error in TemplateMatrix generation: " + e.getMessage());
            fallbackToBasicGeneration();
        }
    }
    
    /**
     * Gets the TemplateMatrix analysis result from the generation process.
     * 
     * @return TemplateMatrix analysis containing template usage and recommendations, or null if not generated
     */
    public TemplateMatrixAnalysisResult getTemplateMatrixAnalysis() {
        return analysisResult;
    }
    
    /**
     * Gets the generated tickets with their template correlations.
     * 
     * @return List of tickets with their corresponding template information
     */
    public List<TemplateCorrelatedTicket> getCorrelatedTickets() {
        return new ArrayList<>(correlatedTickets);
    }
    
    /**
     * Creates a comprehensive TemplateMatrix analysis result from the templates used in generation.
     */
    private TemplateMatrixAnalysisResult createAnalysisResult(List<TemplateMatrixTemplate> allTemplates) {
        try {
            // Determine lottery config ID - try to use a meaningful identifier
            String configId = determineLotteryConfigId();
            
            System.out.println("TemplateMatrix: Performing basic historical analysis");
            return performBasicHistoricalAnalysis(configId, allTemplates);
            
        } catch (Exception e) {
            System.err.println("Error creating TemplateMatrix analysis: " + e.getMessage());
            e.printStackTrace();
            // Return a basic analysis without historical data as last resort
            return new TemplateMatrixAnalysisResult("unknown", allTemplates, 0);
        }
    }
    
    /**
     * Determines the lottery configuration ID from available game information.
     */
    private String determineLotteryConfigId() {
        // Try to construct a meaningful ID from lottery game properties
        // Create a standard format: pick{size}_from_{max}
        return String.format("pick%d_from_%d", pickCount, maxNumber);
    }
    
    /**
     * Performs basic historical analysis using available lottery draw data.
     */
    private TemplateMatrixAnalysisResult performBasicHistoricalAnalysis(String configId, List<TemplateMatrixTemplate> allTemplates) {
        try {
            List<Draw> historicalDraws = history.oldestFirst();
            
            if (historicalDraws == null || historicalDraws.isEmpty()) {
                System.out.println("No historical draws available for basic analysis");
                return new TemplateMatrixAnalysisResult(configId, allTemplates, 0);
            }
            
            // Convert the draws to int arrays
            List<int[]> drawNumbers = historicalDraws.stream()
                .map(draw -> draw.numbers().stream().mapToInt(Integer::intValue).toArray())
                .filter(numbers -> numbers.length > 0)
                .collect(Collectors.toList());
            
            if (drawNumbers.isEmpty()) {
                System.out.println("No valid draw numbers found for analysis");
                return new TemplateMatrixAnalysisResult(configId, allTemplates, 0);
            }
            
            System.out.println(String.format("Performing basic analysis with %d historical draws", drawNumbers.size()));
            
            System.out.println("performBasicHistoricalAnalysis: Resetting template statistics...");
            
            // Debug: Check template groups before reset
            Map<TemplateGroup, Long> groupsBeforeReset = allTemplates.stream()
                    .collect(Collectors.groupingBy(TemplateMatrixTemplate::getTemplateGroup, Collectors.counting()));
            System.out.println("Template groups before statistics reset: " + groupsBeforeReset);
            
            // Reset template statistics
            for (TemplateMatrixTemplate template : allTemplates) {
                template.setHitCount(0);
                template.setGamesOut(0);
                template.setActualFrequency(0.0);
                template.setSuccessToFailureRatio(0.0);
                template.setOverdue(false);
            }
            
            // Debug: Check template groups after reset
            Map<TemplateGroup, Long> groupsAfterReset = allTemplates.stream()
                    .collect(Collectors.groupingBy(TemplateMatrixTemplate::getTemplateGroup, Collectors.counting()));
            System.out.println("Template groups after statistics reset: " + groupsAfterReset);
            
            // Analyze each draw against templates
            analyzeDrawsAgainstTemplates(drawNumbers, allTemplates);
            
            // Update template metrics
            updateBasicTemplateMetrics(allTemplates, drawNumbers.size());
            
            return new TemplateMatrixAnalysisResult(configId, allTemplates, drawNumbers.size());
            
        } catch (Exception e) {
            System.err.println("Error in basic historical analysis: " + e.getMessage());
            return new TemplateMatrixAnalysisResult(configId, allTemplates, 0);
        }
    }
    
    /**
     * Analyzes draws against templates to populate hit counts and games out.
     */
    private void analyzeDrawsAgainstTemplates(List<int[]> draws, List<TemplateMatrixTemplate> templates) {
        // Process draws in reverse order for proper games-out counting
        List<int[]> reversedDraws = new ArrayList<>(draws);
        Collections.reverse(reversedDraws);
        
        int totalMatches = 0;
        for (int drawIndex = 0; drawIndex < reversedDraws.size(); drawIndex++) {
            int[] draw = reversedDraws.get(drawIndex);
            boolean drawMatchedAnyTemplate = false;
            
            for (TemplateMatrixTemplate template : templates) {
                if (template.matches(draw)) {
                    template.recordHit();
                    totalMatches++;
                    drawMatchedAnyTemplate = true;
                    
                    // Debug: Log first few matches
                    if (totalMatches <= 5) {
                        System.out.println(String.format("Historical Match: Draw %s matches template %s", 
                                Arrays.toString(draw), template.getPatternString()));
                    }
                } else {
                    template.incrementGamesOut();
                }
            }
            
            // Debug: Check if any draws are not matching any templates
            if (!drawMatchedAnyTemplate && drawIndex < 5) {
                System.out.println(String.format("No Template Match: Draw %s didn't match any template", 
                        Arrays.toString(draw)));
            }
        }
        
        System.out.println(String.format("Historical Analysis: %d total template matches found in %d draws", 
                totalMatches, reversedDraws.size()));
    }
    
    /**
     * Updates basic template metrics after analysis.
     */
    private void updateBasicTemplateMetrics(List<TemplateMatrixTemplate> templates, int totalDraws) {
        for (TemplateMatrixTemplate template : templates) {
            // Update actual frequency
            if (totalDraws > 0) {
                template.setActualFrequency((double) template.getHitCount() / totalDraws);
            }
            
            // Update success-to-failure ratio
            if (template.getGamesOut() > 0) {
                template.setSuccessToFailureRatio((double) template.getHitCount() / template.getGamesOut());
            }
            
            // Calculate basic performance score
            double expectedHits = totalDraws * template.getProbability().doubleValue();
            double actualHits = template.getHitCount();
            double performanceScore = expectedHits > 0 ? (actualHits / expectedHits) * 100 : 0.0;
            template.setPerformanceScore(performanceScore);
            
            // Set overdue status based on games out vs expected frequency
            double expectedFrequency = template.getExpectedFrequency();
            if (expectedFrequency > 0 && template.getGamesOut() > expectedFrequency * 1.5) {
                template.setOverdue(true);
            }
        }
        
        // Debug: Show final hit counts for first few templates
        System.out.println("Final Template Hit Counts:");
        templates.stream().limit(5).forEach(template ->
            System.out.println(String.format("  Template %s: hits=%d, gamesOut=%d", 
                template.getPatternString(), template.getHitCount(), template.getGamesOut()))
        );
        
        System.out.println(String.format("Updated metrics for %d templates based on %d draws", 
                templates.size(), totalDraws));
    }
    
    /**
     * Selects templates based on the configured strategy.
     */
    private List<TemplateMatrixTemplate> selectTemplates(List<TemplateMatrixTemplate> allTemplates) {
        System.out.println(String.format("selectTemplates: Using strategy %s with allowedGroups %s", 
                                        selectionStrategy, allowedGroups));
        List<TemplateMatrixTemplate> filtered = new ArrayList<>();
        
        switch (selectionStrategy) {
            case BEST_ONLY:
                filtered = allTemplates.stream()
                        .filter(t -> t.getTemplateGroup() == TemplateGroup.BEST)
                        .collect(Collectors.toList());
                break;
                
            case BEST_AND_GOOD:
                filtered = allTemplates.stream()
                        .filter(t -> allowedGroups.contains(t.getTemplateGroup()))
                        .collect(Collectors.toList());
                break;
                
            case HIGH_PROBABILITY:
                filtered = allTemplates.stream()
                        .filter(t -> t.getProbability().doubleValue() >= minimumProbabilityThreshold)
                        .filter(t -> allowedGroups.contains(t.getTemplateGroup())) // Respect user's group preferences
                        .sorted((t1, t2) -> t2.getProbability().compareTo(t1.getProbability()))
                        .limit(Math.max(5, allTemplates.size() / 4)) // Top 25% or minimum 5
                        .collect(Collectors.toList());
                System.out.println(String.format("HIGH_PROBABILITY: Filtered to %d templates from allowedGroups %s", filtered.size(), allowedGroups));
                break;
                
            case PERFORMANCE_BASED:
                filtered = allTemplates.stream()
                        .filter(t -> t.getPerformanceScore() > 0.8) // Above average performance
                        .filter(t -> allowedGroups.contains(t.getTemplateGroup())) // Respect user's group preferences
                        .sorted((t1, t2) -> Double.compare(t2.getPerformanceScore(), t1.getPerformanceScore()))
                        .collect(Collectors.toList());
                System.out.println(String.format("PERFORMANCE_BASED: Filtered to %d templates from allowedGroups %s", filtered.size(), allowedGroups));
                break;
                
            case TIMING_AWARE:
                if (useTimingIndicators && considerOverduePatterns) {
                    filtered = allTemplates.stream()
                            .filter(t -> t.getTimingIndicator() == TemplateMatrixTemplate.TimingIndicator.OVERDUE ||
                                       t.getTimingIndicator() == TemplateMatrixTemplate.TimingIndicator.APPROACHING_DUE)
                            .collect(Collectors.toList());
                    System.out.println(String.format("TIMING_AWARE: Found %d overdue/approaching templates", filtered.size()));
                }
                // Fall back to best templates if no overdue patterns found
                if (filtered.isEmpty()) {
                    System.out.println(String.format("TIMING_AWARE: No overdue templates found, using allowedGroups: %s", allowedGroups));
                    
                    // Debug: Count templates by group before filtering
                    Map<TemplateGroup, Long> groupCounts = allTemplates.stream()
                            .collect(Collectors.groupingBy(TemplateMatrixTemplate::getTemplateGroup, Collectors.counting()));
                    System.out.println("Template distribution before filtering: " + groupCounts);
                    
                    filtered = allTemplates.stream()
                            .filter(t -> allowedGroups.contains(t.getTemplateGroup()))
                            .limit(10)
                            .collect(Collectors.toList());
                    
                    System.out.println(String.format("TIMING_AWARE: Selected %d templates from allowedGroups", filtered.size()));
                    
                    // Debug: Show what groups were actually selected
                    if (!filtered.isEmpty()) {
                        Map<TemplateGroup, Long> selectedGroups = filtered.stream()
                                .collect(Collectors.groupingBy(TemplateMatrixTemplate::getTemplateGroup, Collectors.counting()));
                        System.out.println("Actually selected template groups: " + selectedGroups);
                    }
                }
                break;
                
            case BALANCED:
            default:
                // Balanced selection: some from each viable group, visiting the groups in
                // declaration order (an EnumMap), so the output depends only on the random source
                Map<TemplateGroup, List<TemplateMatrixTemplate>> byGroup = allTemplates.stream()
                        .filter(t -> allowedGroups.contains(t.getTemplateGroup()))
                        .collect(Collectors.groupingBy(TemplateMatrixTemplate::getTemplateGroup,
                                () -> new EnumMap<>(TemplateGroup.class), Collectors.toList()));
                
                for (Map.Entry<TemplateGroup, List<TemplateMatrixTemplate>> entry : byGroup.entrySet()) {
                    List<TemplateMatrixTemplate> templates = entry.getValue();
                    int selectCount = Math.max(1, templates.size() / 4); // 25% from each group
                    List<TemplateMatrixTemplate> selected = templates.stream()
                            .sorted((t1, t2) -> t2.getProbability().compareTo(t1.getProbability()))
                            .limit(selectCount)
                            .collect(Collectors.toList());
                    filtered.addAll(selected);
                }
                break;
        }
        
        List<TemplateMatrixTemplate> result = filtered.isEmpty() ? allTemplates.subList(0, Math.min(5, allTemplates.size())) : filtered;
        
        // Debug: Show what was actually selected
        Map<TemplateGroup, Long> selectedGroups = result.stream()
                .collect(Collectors.groupingBy(TemplateMatrixTemplate::getTemplateGroup, Collectors.counting()));
        System.out.println(String.format("selectTemplates: Selected %d templates with groups: %s", 
                                        result.size(), selectedGroups));
        
        // Debug: Show first few selected templates in detail
        System.out.println("Selected template details:");
        result.stream().limit(5).forEach(template -> 
            System.out.println(String.format("  Pattern: %s, Group: %s, Probability: %.6f", 
                template.getPatternString(), 
                template.getTemplateGroup(), 
                template.getProbability().doubleValue()))
        );
        
        return result;
    }
    
    /**
     * Generates number sets for a specific template.
     */
    private List<int[]> generateNumbersForTemplate(TemplateMatrixTemplate template, int count) {
        List<int[]> numbers = new ArrayList<>();
        Set<String> uniqueNumbers = new HashSet<>();
        Random random = randomSource.next();
        
        int attempts = 0;
        int maxAttempts = count * 10; // Prevent infinite loops
        
        while (numbers.size() < count && attempts < maxAttempts) {
            int[] numberSet = generateSingleNumberSet(template, random);
            Arrays.sort(numberSet);
            String numberString = Arrays.toString(numberSet);
            
            if (uniqueNumbers.add(numberString)) {
                numbers.add(numberSet);
            }
            attempts++;
        }
        
        return numbers;
    }
    
    /**
     * Generates a single number set that matches the template pattern.
     */
    private int[] generateSingleNumberSet(TemplateMatrixTemplate template, Random random) {
        int totalPicks = template.getTotalNumbers();
        int[] numberSet = new int[totalPicks];
        Set<Integer> usedNumbers = new HashSet<>();
        int index = 0;
        
        int midpoint = template.getMidpoint();
        
        // Generate low-odd numbers
        for (int i = 0; i < template.getLowOdd(); i++) {
            numberSet[index++] = generateUniqueNumber(random, 1, midpoint, true, usedNumbers);
        }
        
        // Generate low-even numbers
        for (int i = 0; i < template.getLowEven(); i++) {
            numberSet[index++] = generateUniqueNumber(random, 1, midpoint, false, usedNumbers);
        }
        
        // Generate high-odd numbers
        for (int i = 0; i < template.getHighOdd(); i++) {
            numberSet[index++] = generateUniqueNumber(random, midpoint + 1, maxNumber, true, usedNumbers);
        }
        
        // Generate high-even numbers
        for (int i = 0; i < template.getHighEven(); i++) {
            numberSet[index++] = generateUniqueNumber(random, midpoint + 1, maxNumber, false, usedNumbers);
        }
        
        return numberSet;
    }
    
    /**
     * Generates a unique number within specified constraints.
     */
    private int generateUniqueNumber(Random random, int min, int max, boolean mustBeOdd, Set<Integer> used) {
        int attempts = 0;
        int maxAttempts = (max - min + 1) * 2;
        
        while (attempts < maxAttempts) {
            int number = random.nextInt(max - min + 1) + min;
            
            if ((number % 2 == 1) == mustBeOdd && used.add(number)) {
                return number;
            }
            attempts++;
        }
        
        // Fallback: find any available number with correct parity
        for (int num = min; num <= max; num++) {
            if ((num % 2 == 1) == mustBeOdd && used.add(num)) {
                return num;
            }
        }
        
        // Last resort: any available number
        for (int num = min; num <= max; num++) {
            if (used.add(num)) {
                return num;
            }
        }
        
        return min; // Should never reach here in practice
    }
    
    /**
     * Removes duplicate number sets and shuffles for variety while maintaining template correlations.
     */
    private void removeDuplicatesAndShuffle() {
        Set<String> uniqueSets = new HashSet<>();
        List<int[]> uniqueNumbers = new ArrayList<>();
        List<TemplateCorrelatedTicket> uniqueCorrelatedTickets = new ArrayList<>();
        
        // Remove duplicates while maintaining template correlations
        for (int i = 0; i < generatedNumbers.size() && i < correlatedTickets.size(); i++) {
            int[] numbers = generatedNumbers.get(i);
            TemplateCorrelatedTicket correlatedTicket = correlatedTickets.get(i);
            
            // Sort numbers for comparison but keep original in correlation
            int[] sortedNumbers = Arrays.copyOf(numbers, numbers.length);
            Arrays.sort(sortedNumbers);
            String numberString = Arrays.toString(sortedNumbers);
            
            if (uniqueSets.add(numberString)) {
                uniqueNumbers.add(sortedNumbers);
                // Update the correlated ticket with sorted numbers
                uniqueCorrelatedTickets.add(new TemplateCorrelatedTicket(sortedNumbers, 
                    getTemplateFromCorrelatedTicket(correlatedTicket)));
            }
        }
        
        // Shuffle both lists together to maintain correlation
        List<Integer> indices = new ArrayList<>();
        for (int i = 0; i < uniqueNumbers.size(); i++) {
            indices.add(i);
        }
        Collections.shuffle(indices, randomSource.next());
        
        List<int[]> shuffledNumbers = new ArrayList<>();
        List<TemplateCorrelatedTicket> shuffledCorrelated = new ArrayList<>();
        
        for (int index : indices) {
            shuffledNumbers.add(uniqueNumbers.get(index));
            shuffledCorrelated.add(uniqueCorrelatedTickets.get(index));
        }
        
        // Replace with unique, shuffled sets
        generatedNumbers.clear();
        generatedNumbers.addAll(shuffledNumbers);
        correlatedTickets.clear();
        correlatedTickets.addAll(shuffledCorrelated);
    }
    
    /**
     * Helper to extract template information from a TemplateCorrelatedTicket for recreation.
     */
    private TemplateMatrixTemplate getTemplateFromCorrelatedTicket(TemplateCorrelatedTicket correlatedTicket) {
        // Create a template preserving all the original information including group
        TemplateMatrixTemplate template = new TemplateMatrixTemplate(
            parsePatternComponent(correlatedTicket.getTemplatePattern(), 0), // lowOdd
            parsePatternComponent(correlatedTicket.getTemplatePattern(), 1), // lowEven  
            parsePatternComponent(correlatedTicket.getTemplatePattern(), 2), // highOdd
            parsePatternComponent(correlatedTicket.getTemplatePattern(), 3), // highEven
            correlatedTicket.getTemplateProbability(),
            (maxNumber + 1) / 2 // midpoint estimation
        );
        
        // CRITICAL: Preserve the original template group and performance data
        template.setTemplateGroup(correlatedTicket.getTemplateGroup());
        template.setHitCount(correlatedTicket.getTemplateHitCount());
        template.setGamesOut(correlatedTicket.getTemplateGamesOut());
        template.setPerformanceScore(correlatedTicket.getTemplatePerformanceScore());
        template.setOverdue(correlatedTicket.isTemplateOverdue());
        
        return template;
    }
    
    /**
     * Helper to parse a component from template pattern string (e.g., "2-1-1-1").
     */
    private int parsePatternComponent(String pattern, int index) {
        String[] parts = pattern.split("-");
        return index < parts.length ? Integer.parseInt(parts[index]) : 0;
    }
    
    /**
     * Fallback to basic generation if TemplateMatrix processing fails.
     */
    private void fallbackToBasicGeneration() {
        try {
            // Use the existing basic pattern generator as fallback
            List<Pattern> patterns = PatternGenerator.generatePatterns(maxNumber, pickCount);
            
            // Use top patterns for generation: those in the BEST or GOOD group by probability percentile
            List<Pattern> topPatterns = new ArrayList<>();
            for (int i = 0; i < patterns.size() && topPatterns.size() < 5; i++) {
                TemplateGroup group = TemplateGroup.fromProbabilityPercentile(1.0 - ((double) i / patterns.size()));
                if (group == TemplateGroup.BEST || group == TemplateGroup.GOOD) {
                    topPatterns.add(patterns.get(i));
                }
            }
            
            for (Pattern pattern : topPatterns) {
                // Convert Pattern to basic number generation
                for (int i = 0; i < numberSetsPerTemplate; i++) {
                    int[] numbers = generateBasicNumbers(pattern);
                    generatedNumbers.add(numbers);
                }
            }
            
        } catch (Exception e) {
            System.err.println("Fallback generation also failed: " + e.getMessage());
        }
    }
    
    /**
     * Generates basic numbers from a Pattern (fallback method).
     */
    private int[] generateBasicNumbers(Pattern pattern) {
        Random random = randomSource.next();
        int[] numbers = new int[pattern.totalNumbers()];
        Set<Integer> used = new HashSet<>();
        int index = 0;
        
        // This is a simplified version - in practice you'd want more sophisticated logic
        for (int i = 0; i < pattern.totalNumbers(); i++) {
            int number;
            do {
                number = random.nextInt(maxNumber) + 1;
            } while (!used.add(number));
            numbers[index++] = number;
        }
        
        return numbers;
    }
    
    // Configuration methods
    
    public void setAllowedGroups(Set<TemplateGroup> allowedGroups) {
        this.allowedGroups = allowedGroups;
    }
    
    public void setUseTimingIndicators(boolean useTimingIndicators) {
        this.useTimingIndicators = useTimingIndicators;
    }
    
    public void setConsiderOverduePatterns(boolean considerOverduePatterns) {
        this.considerOverduePatterns = considerOverduePatterns;
    }
    
    public void setMinimumProbabilityThreshold(double minimumProbabilityThreshold) {
        this.minimumProbabilityThreshold = minimumProbabilityThreshold;
    }
    
    /**
     * Gets generation statistics for analysis.
     */
    public GenerationStatistics getStatistics() {
        if (generatedNumbers.isEmpty()) {
            return new GenerationStatistics(0, 0, Collections.emptyMap());
        }
        
        // Analyze generated numbers for template distribution
        Map<String, Integer> templateDistribution = new HashMap<>();
        int uniqueSets = new HashSet<>(generatedNumbers.stream()
                .map(Arrays::toString)
                .collect(Collectors.toList())).size();
        
        return new GenerationStatistics(
                generatedNumbers.size(),
                uniqueSets,
                templateDistribution
        );
    }
    
    /**
     * Statistics about the generation process.
     */
    public static class GenerationStatistics {
        private final int totalGenerated;
        private final int uniqueSets;
        private final Map<String, Integer> templateDistribution;
        
        public GenerationStatistics(int totalGenerated, int uniqueSets, Map<String, Integer> templateDistribution) {
            this.totalGenerated = totalGenerated;
            this.uniqueSets = uniqueSets;
            this.templateDistribution = templateDistribution;
        }
        
        public int getTotalGenerated() { return totalGenerated; }
        public int getUniqueSets() { return uniqueSets; }
        public Map<String, Integer> getTemplateDistribution() { return templateDistribution; }
        
        @Override
        public String toString() {
            return String.format("GenerationStats{total=%d, unique=%d, templates=%d}", 
                    totalGenerated, uniqueSets, templateDistribution.size());
        }
    }
    
    /**
     * Generates tickets using round robin distribution across templates.
     * Ensures even distribution by cycling through templates repeatedly until all tickets are generated.
     */
    private void generateTicketsWithRoundRobin(List<TemplateMatrixTemplate> selectedTemplates, int totalTicketsRequested) {
        if (selectedTemplates.isEmpty()) {
            System.out.println("No templates selected, using fallback generation");
            fallbackToBasicGeneration();
            return;
        }
        
        int templatesCount = selectedTemplates.size();
        int ticketsGenerated = 0;
        int templateIndex = 0;
        
        System.out.println(String.format("TemplateMatrix Round Robin: Using %d templates to generate %d tickets", 
                templatesCount, totalTicketsRequested));
        
        // Track tickets per template for reporting
        Map<String, Integer> ticketsPerTemplate = new HashMap<>();
        
        // Round robin generation: cycle through templates until we have enough tickets
        while (ticketsGenerated < totalTicketsRequested) {
            TemplateMatrixTemplate currentTemplate = selectedTemplates.get(templateIndex);
            
            try {
                // Generate one ticket from the current template
                List<int[]> templateNumbers = generateNumbersForTemplate(currentTemplate, 1);
                
                if (!templateNumbers.isEmpty()) {
                    int[] ticket = templateNumbers.get(0);
                    
                    // Debug: Check template group before creating correlation
                    if (ticketsGenerated < 5) { // Only log first few to avoid spam
                        System.out.println(String.format("Round Robin Debug: Template %s has group %s (probability: %.6f)", 
                                currentTemplate.getPatternString(), 
                                currentTemplate.getTemplateGroup(),
                                currentTemplate.getProbability().doubleValue()));
                    }
                    
                    // Track template correlation
                    correlatedTickets.add(new TemplateCorrelatedTicket(ticket, currentTemplate));
                    generatedNumbers.add(ticket);
                    
                    ticketsGenerated++;
                    
                    // Update template usage statistics
                    String templateKey = currentTemplate.getPatternString();
                    ticketsPerTemplate.put(templateKey, ticketsPerTemplate.getOrDefault(templateKey, 0) + 1);
                    
                    if (ticketsGenerated % 20 == 0 || ticketsGenerated == totalTicketsRequested) {
                        System.out.println(String.format("Round Robin: Generated %d/%d tickets", 
                                ticketsGenerated, totalTicketsRequested));
                    }
                }
                
            } catch (Exception e) {
                System.err.println("Error generating ticket from template " + currentTemplate.getPatternString() + ": " + e.getMessage());
            }
            
            // Move to next template (round robin)
            templateIndex = (templateIndex + 1) % templatesCount;
        }
        
        // Report final distribution
        System.out.println("Round Robin Distribution Summary:");
        ticketsPerTemplate.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .forEach(entry -> System.out.println(String.format("  Template %s: %d tickets", 
                        entry.getKey(), entry.getValue())));
        
        // Remove duplicates and shuffle for variety
        removeDuplicatesAndShuffle();
        
        // Ensure exact count (in case removeDuplicatesAndShuffle changed the count)
        if (generatedNumbers.size() > totalTicketsRequested) {
            generatedNumbers.subList(totalTicketsRequested, generatedNumbers.size()).clear();
            // Also trim the correlated tickets to match
            if (correlatedTickets.size() > totalTicketsRequested) {
                correlatedTickets.subList(totalTicketsRequested, correlatedTickets.size()).clear();
            }
        }
        
        System.out.println(String.format("Round Robin Complete: %d unique tickets generated from %d templates", 
                generatedNumbers.size(), templatesCount));
    }
    
    /**
     * Performs historical analysis directly on the template objects that will be used for generation.
     * This ensures that the templates used for ticket generation have the correct hit counts and performance data.
     */
    private void performBasicHistoricalAnalysisOnTemplates(List<TemplateMatrixTemplate> templates) {
        try {
            List<Draw> historicalDraws = history.oldestFirst();
            
            if (historicalDraws == null || historicalDraws.isEmpty()) {
                System.out.println("No historical draws available for template analysis");
                return;
            }
            
            // Convert the draws to int arrays
            List<int[]> drawNumbers = historicalDraws.stream()
                .map(draw -> draw.numbers().stream().mapToInt(Integer::intValue).toArray())
                .filter(numbers -> numbers.length > 0)
                .collect(Collectors.toList());
            
            if (drawNumbers.isEmpty()) {
                System.out.println("No valid draw numbers found for template analysis");
                return;
            }
            
            System.out.println(String.format("Analyzing %d templates against %d historical draws", 
                                            templates.size(), drawNumbers.size()));
            
            // Reset template statistics before analysis
            for (TemplateMatrixTemplate template : templates) {
                template.setHitCount(0);
                template.setGamesOut(0);
                template.setActualFrequency(0.0);
                template.setSuccessToFailureRatio(0.0);
                template.setOverdue(false);
            }
            
            // Analyze draws against templates
            analyzeDrawsAgainstTemplates(drawNumbers, templates);
            
            // Update template metrics
            updateBasicTemplateMetrics(templates, drawNumbers.size());
            
        } catch (Exception e) {
            System.err.println("Error in template historical analysis: " + e.getMessage());
            e.printStackTrace();
        }
    }
}