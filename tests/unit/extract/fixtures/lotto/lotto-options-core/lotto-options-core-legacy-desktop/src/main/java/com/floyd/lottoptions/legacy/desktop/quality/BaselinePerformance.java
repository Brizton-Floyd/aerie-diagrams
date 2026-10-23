package com.floyd.lottoptions.legacy.desktop.quality;

/**
 * Represents baseline performance metrics for random lottery ticket selection.
 * Used as the comparison point for measuring improvement of generated tickets.
 */
public class BaselinePerformance {
    
    private final double expectedWinRate;
    private final double mathematicalOdds;
    private final double historicalPerformance;
    private final String targetTier;
    private final String lotteryConfigId;
    
    public BaselinePerformance(double expectedWinRate, double mathematicalOdds, 
                              double historicalPerformance, String targetTier, String lotteryConfigId) {
        this.expectedWinRate = expectedWinRate;
        this.mathematicalOdds = mathematicalOdds;
        this.historicalPerformance = historicalPerformance;
        this.targetTier = targetTier;
        this.lotteryConfigId = lotteryConfigId;
    }
    
    public double getExpectedWinRate() {
        return expectedWinRate;
    }
    
    public double getMathematicalOdds() {
        return mathematicalOdds;
    }
    
    public double getHistoricalPerformance() {
        return historicalPerformance;
    }
    
    public String getTargetTier() {
        return targetTier;
    }
    
    public String getLotteryConfigId() {
        return lotteryConfigId;
    }
    
    @Override
    public String toString() {
        return String.format("BaselinePerformance{tier=%s, expectedRate=%.6f, mathOdds=%.6f, historicalRate=%.6f}",
                targetTier, expectedWinRate, mathematicalOdds, historicalPerformance);
    }
}