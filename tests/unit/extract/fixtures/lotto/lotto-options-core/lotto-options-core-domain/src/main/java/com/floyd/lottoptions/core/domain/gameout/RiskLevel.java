package com.floyd.lottoptions.core.domain.gameout;

/**
 * How much of an account a multi-game play may risk.
 *
 * <p>{@link #toString()} is part of the recommendation's text: the bet-level advice names the
 * risk tolerance as, for example, {@code Medium (0.5 risk factor)}.</p>
 */
public enum RiskLevel {

    VERY_LOW("Very Low", 0.1),
    LOW("Low", 0.3),
    MEDIUM("Medium", 0.5),
    HIGH("High", 0.7),
    VERY_HIGH("Very High", 0.9);

    private final String displayName;
    private final double riskFactor;

    RiskLevel(String displayName, double riskFactor) {
        this.displayName = displayName;
        this.riskFactor = riskFactor;
    }

    /**
     * @return the share of the account a play may spend, from {@code 0.1} to {@code 0.9}
     */
    public double riskFactor() {
        return riskFactor;
    }

    @Override
    public String toString() {
        return String.format("%s (%.1f risk factor)", displayName, riskFactor);
    }
}
