package com.floyd.lottoptions.legacy.desktop.shared.template;

import java.util.Arrays;

/**
 * Represents a lottery ticket with its corresponding TemplateMatrix template information.
 * This allows tracking which template generated each specific ticket.
 */
public class TemplateCorrelatedTicket {
    
    private final int[] numbers;
    private final String templatePattern;
    private final TemplateGroup templateGroup;
    private final double templateProbability;
    private final int templateHitCount;
    private final int templateGamesOut;
    private final double templatePerformanceScore;
    private final boolean templateIsOverdue;
    
    /**
     * Creates a correlated ticket with template information.
     *
     * @param numbers The lottery numbers for this ticket
     * @param template The template that generated this ticket
     */
    public TemplateCorrelatedTicket(int[] numbers, TemplateMatrixTemplate template) {
        this.numbers = Arrays.copyOf(numbers, numbers.length);
        this.templatePattern = template.getPatternString();
        this.templateGroup = template.getTemplateGroup();
        this.templateProbability = template.getProbability().doubleValue();
        this.templateHitCount = template.getHitCount();
        this.templateGamesOut = template.getGamesOut();
        this.templatePerformanceScore = template.getPerformanceScore();
        this.templateIsOverdue = template.isOverdue();
    }
    
    /**
     * Gets the lottery numbers.
     */
    public int[] getNumbers() {
        return Arrays.copyOf(numbers, numbers.length);
    }
    
    /**
     * Gets the template pattern string (e.g., "2-1-1-1").
     */
    public String getTemplatePattern() {
        return templatePattern;
    }
    
    /**
     * Gets the template group classification.
     */
    public TemplateGroup getTemplateGroup() {
        return templateGroup;
    }
    
    /**
     * Gets the mathematical probability of the template.
     */
    public double getTemplateProbability() {
        return templateProbability;
    }
    
    /**
     * Gets the historical hit count of the template.
     */
    public int getTemplateHitCount() {
        return templateHitCount;
    }
    
    /**
     * Gets the games out count for the template.
     */
    public int getTemplateGamesOut() {
        return templateGamesOut;
    }
    
    /**
     * Gets the performance score of the template.
     */
    public double getTemplatePerformanceScore() {
        return templatePerformanceScore;
    }
    
    /**
     * Checks if the template is currently overdue.
     */
    public boolean isTemplateOverdue() {
        return templateIsOverdue;
    }
    
    /**
     * Gets formatted numbers as string for display.
     */
    public String getNumbersAsString() {
        return Arrays.toString(numbers);
    }
    
    /**
     * Verifies that this ticket actually matches the template pattern.
     */
    public boolean verifyTemplateMatch(TemplateMatrixTemplate template) {
        return template.matches(this.numbers);
    }
    
    @Override
    public String toString() {
        return String.format("Ticket%s -> Template[%s] (%s, %.4f prob, %d hits, %d out, %.1f score%s)",
                getNumbersAsString(),
                templatePattern,
                templateGroup,
                templateProbability,
                templateHitCount,
                templateGamesOut,
                templatePerformanceScore,
                templateIsOverdue ? ", OVERDUE" : "");
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        
        TemplateCorrelatedTicket that = (TemplateCorrelatedTicket) obj;
        return Arrays.equals(numbers, that.numbers) && 
               templatePattern.equals(that.templatePattern);
    }
    
    @Override
    public int hashCode() {
        return Arrays.hashCode(numbers) * 31 + templatePattern.hashCode();
    }
}