package com.floyd.model.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.floyd.model.request.BalanceRecommendationRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BalanceRecommendationResponse {
    
    @JsonProperty("gameId")
    private String gameId;
    
    @JsonProperty("betLevel")
    private BigDecimal betLevel;
    
    @JsonProperty("worstMonthLoss")
    private BigDecimal worstMonthLoss;
    
    @JsonProperty("recommendedBalance")
    private BigDecimal recommendedBalance;
    
    @JsonProperty("conservativeBalance")
    private BigDecimal conservativeBalance;
    
    @JsonProperty("aggressiveBalance")
    private BigDecimal aggressiveBalance;
    
    @JsonProperty("riskTolerance")
    private BalanceRecommendationRequest.RiskTolerance riskTolerance;
    
    @JsonProperty("reasoning")
    private String reasoning;
}
