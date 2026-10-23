package com.floyd.model.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BalanceRecommendationRequest {
    
    @JsonProperty("gameId")
    private String gameId;
    
    @JsonProperty("state")
    private String state;
    
    @JsonProperty("betLevel")
    private BigDecimal betLevel;
    
    @JsonProperty("riskTolerance")
    private RiskTolerance riskTolerance;
    
    public enum RiskTolerance {
        CONSERVATIVE,
        MODERATE,
        AGGRESSIVE
    }
    
    public void validate() {
        if (gameId == null || gameId.trim().isEmpty()) {
            throw new IllegalArgumentException("gameId cannot be null or empty");
        }
        if (state == null || state.trim().isEmpty()) {
            throw new IllegalArgumentException("state cannot be null or empty");
        }
        if (betLevel == null) {
            throw new IllegalArgumentException("betLevel cannot be null");
        }
        if (betLevel.compareTo(new BigDecimal("0.25")) < 0) {
            throw new IllegalArgumentException("betLevel must be at least 0.25");
        }
        if (riskTolerance == null) {
            throw new IllegalArgumentException("riskTolerance cannot be null");
        }
    }
}
