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
public class MonthlyBacktestRequest {
    
    @JsonProperty("gameId")
    private String gameId;
    
    @JsonProperty("state")
    private String state;
    
    @JsonProperty("betLevel")
    private BigDecimal betLevel;
    
    @JsonProperty("year")
    private Integer year;
    
    @JsonProperty("maxGameOut")
    private Integer maxGameOut;
    
    @JsonProperty("hPoolSize")
    @Builder.Default
    private Integer hPoolSize = 6;
    
    @JsonProperty("mPoolSize")
    @Builder.Default
    private Integer mPoolSize = 8;
    
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
        if (year == null || year < 2000) {
            throw new IllegalArgumentException("year must be at least 2000");
        }
        if (maxGameOut == null || maxGameOut < 1) {
            throw new IllegalArgumentException("maxGameOut must be at least 1");
        }
    }
}
