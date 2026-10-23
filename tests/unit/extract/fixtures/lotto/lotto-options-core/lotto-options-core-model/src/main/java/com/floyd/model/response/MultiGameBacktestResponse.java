package com.floyd.model.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MultiGameBacktestResponse {
    
    @JsonProperty("gameIds")
    private List<String> gameIds;
    
    @JsonProperty("stateName")
    private String stateName;
    
    @JsonProperty("betLevel")
    private BigDecimal betLevel;
    
    @JsonProperty("years")
    private List<Integer> years;
    
    @JsonProperty("portfolioSummary")
    private PortfolioSummary portfolioSummary;
    
    @JsonProperty("gameResults")
    private List<GameResult> gameResults;
    
    @JsonProperty("dailyBreakdown")
    private List<DailyStats> dailyBreakdown;
    
    @JsonProperty("monthlyBreakdown")
    private List<MonthlyStats> monthlyBreakdown;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PortfolioSummary {
        @JsonProperty("totalUniqueDates")
        private Integer totalUniqueDates;
        
        @JsonProperty("datesWithPlays")
        private Integer datesWithPlays;
        
        @JsonProperty("datesSkipped")
        private Integer datesSkipped;
        
        @JsonProperty("totalPlays")
        private Integer totalPlays;
        
        @JsonProperty("totalWins")
        private Integer totalWins;
        
        @JsonProperty("overallWinRate")
        private BigDecimal overallWinRate;
        
        @JsonProperty("totalCost")
        private BigDecimal totalCost;
        
        @JsonProperty("totalPayout")
        private BigDecimal totalPayout;
        
        @JsonProperty("netProfit")
        private BigDecimal netProfit;
        
        @JsonProperty("roi")
        private BigDecimal roi;
        
        @JsonProperty("avgPlaysPerDate")
        private BigDecimal avgPlaysPerDate;
        
        @JsonProperty("avgCostPerDate")
        private BigDecimal avgCostPerDate;
        
        @JsonProperty("greenMonths")
        private Integer greenMonths;
        
        @JsonProperty("redMonths")
        private Integer redMonths;
        
        @JsonProperty("startingBalance")
        private BigDecimal startingBalance;
        
        @JsonProperty("endingBalance")
        private BigDecimal endingBalance;
        
        @JsonProperty("peakBalance")
        private BigDecimal peakBalance;
        
        @JsonProperty("lowestBalance")
        private BigDecimal lowestBalance;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GameResult {
        @JsonProperty("gameId")
        private String gameId;
        
        @JsonProperty("totalDraws")
        private Integer totalDraws;
        
        @JsonProperty("plays")
        private Integer plays;
        
        @JsonProperty("wins")
        private Integer wins;
        
        @JsonProperty("winRate")
        private BigDecimal winRate;
        
        @JsonProperty("totalCost")
        private BigDecimal totalCost;
        
        @JsonProperty("totalPayout")
        private BigDecimal totalPayout;
        
        @JsonProperty("netProfit")
        private BigDecimal netProfit;
        
        @JsonProperty("roi")
        private BigDecimal roi;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DailyStats {
        @JsonProperty("date")
        private String date;
        
        @JsonProperty("gamesPlayed")
        private List<String> gamesPlayed;
        
        @JsonProperty("totalPlays")
        private Integer totalPlays;
        
        @JsonProperty("totalWins")
        private Integer totalWins;
        
        @JsonProperty("totalCost")
        private BigDecimal totalCost;
        
        @JsonProperty("totalPayout")
        private BigDecimal totalPayout;
        
        @JsonProperty("netProfit")
        private BigDecimal netProfit;
        
        @JsonProperty("status")
        private String status;
        
        @JsonProperty("startingBalance")
        private BigDecimal startingBalance;
        
        @JsonProperty("currentBalance")
        private BigDecimal currentBalance;
        
        @JsonProperty("winLossPattern")
        private String winLossPattern;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MonthlyStats {
        @JsonProperty("month")
        private String month;
        
        @JsonProperty("totalDates")
        private Integer totalDates;
        
        @JsonProperty("datesWithPlays")
        private Integer datesWithPlays;
        
        @JsonProperty("totalPlays")
        private Integer totalPlays;
        
        @JsonProperty("totalWins")
        private Integer totalWins;
        
        @JsonProperty("winRate")
        private BigDecimal winRate;
        
        @JsonProperty("totalCost")
        private BigDecimal totalCost;
        
        @JsonProperty("totalPayout")
        private BigDecimal totalPayout;
        
        @JsonProperty("netProfit")
        private BigDecimal netProfit;
        
        @JsonProperty("status")
        private String status;
    }
}
