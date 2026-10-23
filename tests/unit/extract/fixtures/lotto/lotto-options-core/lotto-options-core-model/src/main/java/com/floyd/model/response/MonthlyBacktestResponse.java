package com.floyd.model.response;

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
public class MonthlyBacktestResponse {
    
    @JsonProperty("gameId")
    private String gameId;
    
    @JsonProperty("year")
    private Integer year;
    
    @JsonProperty("betLevel")
    private BigDecimal betLevel;
    
    @JsonProperty("prize")
    private BigDecimal prize;
    
    @JsonProperty("monthlyStats")
    private List<MonthlyStats> monthlyStats;
    
    @JsonProperty("summary")
    private Summary summary;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyStats {
        @JsonProperty("month")
        private String month;
        
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
        
        @JsonProperty("status")
        private String status;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Summary {
        @JsonProperty("totalDraws")
        private Integer totalDraws;
        
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
        
        @JsonProperty("greenMonths")
        private Integer greenMonths;
        
        @JsonProperty("redMonths")
        private Integer redMonths;
        
        @JsonProperty("successRate")
        private BigDecimal successRate;
    }
}
