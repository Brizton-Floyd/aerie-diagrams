package com.floyd.lottoptions.legacy.desktop.generation.engine;

import com.floyd.lottoptions.legacy.desktop.util.NumberFormatter;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Comprehensive historical performance analysis for a set of generated lottery tickets.
 * Shows how the tickets would have performed against all historical draws.
 */
public class HistoricalPerformanceAnalysis {

    private final AnalysisType analysisType;
    private final AnalysisScope analysisScope;
    private final WinSummary winSummary;
    private final Map<String, PrizeBreakdown> prizeBreakdown;
    private final BestPerformingTicket bestPerformingTicket;
    private final PerformanceComparison comparison;
    private final List<String> insights;
    private final boolean fullAnalysisAvailable;
    private final String fullAnalysisEndpoint;

    public HistoricalPerformanceAnalysis(AnalysisType analysisType, AnalysisScope analysisScope,
                                       WinSummary winSummary, Map<String, PrizeBreakdown> prizeBreakdown,
                                       BestPerformingTicket bestPerformingTicket, PerformanceComparison comparison,
                                       List<String> insights, boolean fullAnalysisAvailable, String fullAnalysisEndpoint) {
        this.analysisType = analysisType;
        this.analysisScope = analysisScope;
        this.winSummary = winSummary;
        this.prizeBreakdown = prizeBreakdown;
        this.bestPerformingTicket = bestPerformingTicket;
        this.comparison = comparison;
        this.insights = insights;
        this.fullAnalysisAvailable = fullAnalysisAvailable;
        this.fullAnalysisEndpoint = fullAnalysisEndpoint;
    }

    // Getters
    public AnalysisType getAnalysisType() { return analysisType; }
    public AnalysisScope getAnalysisScope() { return analysisScope; }
    public WinSummary getWinSummary() { return winSummary; }
    public Map<String, PrizeBreakdown> getPrizeBreakdown() { return prizeBreakdown; }
    public BestPerformingTicket getBestPerformingTicket() { return bestPerformingTicket; }
    public PerformanceComparison getComparison() { return comparison; }
    public List<String> getInsights() { return insights; }
    public boolean isFullAnalysisAvailable() { return fullAnalysisAvailable; }
    public String getFullAnalysisEndpoint() { return fullAnalysisEndpoint; }

    /**
     * Type of analysis performed
     */
    public enum AnalysisType {
        FULL,    // Complete analysis of all tickets
        SAMPLE   // Statistical sample for large ticket sets
    }

    /**
     * Scope and parameters of the analysis
     */
    public static class AnalysisScope {
        private final int ticketsAnalyzed;
        private final int totalTickets;
        private final int historicalDraws;
        private final DateRange dateRange;
        private final double yearsSpanned;
        private final String samplingMethod; // null for full analysis

        public AnalysisScope(int ticketsAnalyzed, int totalTickets, int historicalDraws,
                           DateRange dateRange, double yearsSpanned, String samplingMethod) {
            this.ticketsAnalyzed = ticketsAnalyzed;
            this.totalTickets = totalTickets;
            this.historicalDraws = historicalDraws;
            this.dateRange = dateRange;
            this.yearsSpanned = yearsSpanned;
            this.samplingMethod = samplingMethod;
        }

        public int getTicketsAnalyzed() { return ticketsAnalyzed; }
        public int getTotalTickets() { return totalTickets; }
        public int getHistoricalDraws() { return historicalDraws; }
        public DateRange getDateRange() { return dateRange; }
        public double getYearsSpanned() { return NumberFormatter.formatToTwoDecimals(yearsSpanned); }
        public String getSamplingMethod() { return samplingMethod; }
    }

    /**
     * Date range of historical analysis
     */
    public static class DateRange {
        private final LocalDate from;
        private final LocalDate to;

        public DateRange(LocalDate from, LocalDate to) {
            this.from = from;
            this.to = to;
        }

        public LocalDate getFrom() { return from; }
        public LocalDate getTo() { return to; }
    }

    /**
     * Summary of all wins and financial performance
     */
    public static class WinSummary {
        private final int jackpotWins;
        private final int totalWins;
        private final double totalWinnings;
        private final double totalCost;
        private final double netResult;
        private final double roi;
        private final EstimatedValue totalWinsEstimate; // for sample analysis

        public WinSummary(int jackpotWins, int totalWins, double totalWinnings, double totalCost, 
                         double netResult, double roi, EstimatedValue totalWinsEstimate) {
            this.jackpotWins = jackpotWins;
            this.totalWins = totalWins;
            this.totalWinnings = totalWinnings;
            this.totalCost = totalCost;
            this.netResult = netResult;
            this.roi = roi;
            this.totalWinsEstimate = totalWinsEstimate;
        }

        public int getJackpotWins() { return jackpotWins; }
        public int getTotalWins() { return totalWins; }
        public double getTotalWinnings() { return NumberFormatter.formatToTwoDecimals(totalWinnings); }
        public double getTotalCost() { return NumberFormatter.formatToTwoDecimals(totalCost); }
        public double getNetResult() { return NumberFormatter.formatToTwoDecimals(netResult); }
        public double getRoi() { return NumberFormatter.formatToTwoDecimals(roi); }
        public EstimatedValue getTotalWinsEstimate() { return totalWinsEstimate; }
    }

    /**
     * Breakdown by prize tier
     */
    public static class PrizeBreakdown {
        private final int wins;
        private final double totalWinnings;
        private final double frequency; // wins per 1000 draws

        public PrizeBreakdown(int wins, double totalWinnings, double frequency) {
            this.wins = wins;
            this.totalWinnings = totalWinnings;
            this.frequency = frequency;
        }

        public int getWins() { return wins; }
        public double getTotalWinnings() { return NumberFormatter.formatToTwoDecimals(totalWinnings); }
        public double getFrequency() { return NumberFormatter.formatToTwoDecimals(frequency); }
    }

    /**
     * Best performing ticket from the set
     */
    public static class BestPerformingTicket {
        private final int[] ticket;
        private final int wins;
        private final double totalWinnings;
        private final BestWin bestWin;

        public BestPerformingTicket(int[] ticket, int wins, double totalWinnings, BestWin bestWin) {
            this.ticket = ticket;
            this.wins = wins;
            this.totalWinnings = totalWinnings;
            this.bestWin = bestWin;
        }

        public int[] getTicket() { return ticket; }
        public int getWins() { return wins; }
        public double getTotalWinnings() { return NumberFormatter.formatToTwoDecimals(totalWinnings); }
        public BestWin getBestWin() { return bestWin; }
    }

    /**
     * Details of the best single win
     */
    public static class BestWin {
        private final LocalDate date;
        private final int matches;
        private final double prize;

        public BestWin(LocalDate date, int matches, double prize) {
            this.date = date;
            this.matches = matches;
            this.prize = prize;
        }

        public LocalDate getDate() { return date; }
        public int getMatches() { return matches; }
        public double getPrize() { return NumberFormatter.formatToTwoDecimals(prize); }
    }

    /**
     * Performance comparison against benchmarks
     */
    public static class PerformanceComparison {
        private final VsBenchmark vsRandomTickets;
        private final VsBenchmark vsAllPossibleCombinations;

        public PerformanceComparison(VsBenchmark vsRandomTickets, VsBenchmark vsAllPossibleCombinations) {
            this.vsRandomTickets = vsRandomTickets;
            this.vsAllPossibleCombinations = vsAllPossibleCombinations;
        }

        public VsBenchmark getVsRandomTickets() { return vsRandomTickets; }
        public VsBenchmark getVsAllPossibleCombinations() { return vsAllPossibleCombinations; }
    }

    /**
     * Comparison against a benchmark
     */
    public static class VsBenchmark {
        private final double performanceFactor;
        private final double percentile;
        private final String description;

        public VsBenchmark(double performanceFactor, double percentile, String description) {
            this.performanceFactor = performanceFactor;
            this.percentile = percentile;
            this.description = description;
        }

        public double getPerformanceFactor() { return NumberFormatter.formatToTwoDecimals(performanceFactor); }
        public double getPercentile() { return NumberFormatter.formatToTwoDecimals(percentile); }
        public String getDescription() { return description; }
    }

    /**
     * Estimated value with confidence interval (for sample analysis)
     */
    public static class EstimatedValue {
        private final int value;
        private final int[] confidenceRange;
        private final int confidence;

        public EstimatedValue(int value, int[] confidenceRange, int confidence) {
            this.value = value;
            this.confidenceRange = confidenceRange;
            this.confidence = confidence;
        }

        public int getValue() { return value; }
        public int[] getConfidenceRange() { return confidenceRange; }
        public int getConfidence() { return confidence; }
    }

    /**
     * Builder for HistoricalPerformanceAnalysis
     */
    public static class Builder {
        private AnalysisType analysisType = AnalysisType.FULL;
        private AnalysisScope analysisScope;
        private WinSummary winSummary;
        private Map<String, PrizeBreakdown> prizeBreakdown;
        private BestPerformingTicket bestPerformingTicket;
        private PerformanceComparison comparison;
        private List<String> insights;
        private boolean fullAnalysisAvailable = false;
        private String fullAnalysisEndpoint;

        public Builder analysisType(AnalysisType analysisType) {
            this.analysisType = analysisType;
            return this;
        }

        public Builder analysisScope(AnalysisScope analysisScope) {
            this.analysisScope = analysisScope;
            return this;
        }

        public Builder winSummary(WinSummary winSummary) {
            this.winSummary = winSummary;
            return this;
        }

        public Builder prizeBreakdown(Map<String, PrizeBreakdown> prizeBreakdown) {
            this.prizeBreakdown = prizeBreakdown;
            return this;
        }

        public Builder bestPerformingTicket(BestPerformingTicket bestPerformingTicket) {
            this.bestPerformingTicket = bestPerformingTicket;
            return this;
        }

        public Builder comparison(PerformanceComparison comparison) {
            this.comparison = comparison;
            return this;
        }

        public Builder insights(List<String> insights) {
            this.insights = insights;
            return this;
        }

        public Builder fullAnalysisAvailable(boolean fullAnalysisAvailable) {
            this.fullAnalysisAvailable = fullAnalysisAvailable;
            return this;
        }

        public Builder fullAnalysisEndpoint(String fullAnalysisEndpoint) {
            this.fullAnalysisEndpoint = fullAnalysisEndpoint;
            return this;
        }

        public HistoricalPerformanceAnalysis build() {
            return new HistoricalPerformanceAnalysis(analysisType, analysisScope, winSummary,
                    prizeBreakdown, bestPerformingTicket, comparison, insights,
                    fullAnalysisAvailable, fullAnalysisEndpoint);
        }
    }

    public static Builder builder() {
        return new Builder();
    }
}