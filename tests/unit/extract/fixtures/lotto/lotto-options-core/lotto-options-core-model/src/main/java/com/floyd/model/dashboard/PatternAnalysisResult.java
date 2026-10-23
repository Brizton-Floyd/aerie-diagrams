package com.floyd.model.dashboard;

public class PatternAnalysisResult {
    private String pattern;
    private int frequency;
    private double probability;
    private double estimatedHitFrequency;
    private int gamesSinceLastAppearance;

    public PatternAnalysisResult(String pattern, int frequency, double probability, double estimatedHitFrequency, int gamesSinceLastAppearance) {
        this.pattern = pattern;
        this.frequency = frequency;
        this.probability = probability;
        this.estimatedHitFrequency = estimatedHitFrequency;
        this.gamesSinceLastAppearance = gamesSinceLastAppearance;
    }

    public String getPattern() {
        return pattern;
    }

    public int getFrequency() {
        return frequency;
    }

    public double getProbability() {
        return probability;
    }

    public double getEstimatedHitFrequency() {
        return estimatedHitFrequency;
    }

    public int getGamesSinceLastAppearance() {
        return gamesSinceLastAppearance;
    }

    @Override
    public String toString() {
        return String.format("Pattern: %s, Frequency: %d, Probability: %.4f, Estimated Hit Frequency: %.2f, Games Since Last Appearance: %d",
                pattern, frequency, probability, estimatedHitFrequency, gamesSinceLastAppearance);
    }
}