package com.floyd.model.request;

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
public class MultiGameBacktestRequest {
    
    @JsonProperty("gameIds")
    private List<String> gameIds;
    
    @JsonProperty("stateName")
    private String stateName;
    
    @JsonProperty("betLevel")
    private BigDecimal betLevel;
    
    @JsonProperty("years")
    private List<Integer> years;
    
    @JsonProperty("maxGameOut")
    private Integer maxGameOut;
    
    @JsonProperty("autoOptimizeGameOut")
    private Boolean autoOptimizeGameOut;
    
    @JsonProperty("hPoolSize")
    private Integer hPoolSize;
    
    @JsonProperty("mPoolSize")
    private Integer mPoolSize;
    
    @JsonProperty("startingBalance")
    private BigDecimal startingBalance;
    
    @JsonProperty("poolSize")
    private Integer poolSize;
    
    public void validate() {
        if (gameIds == null || gameIds.isEmpty()) {
            throw new IllegalArgumentException("gameIds must contain at least one game");
        }
        
        if (stateName == null || stateName.trim().isEmpty()) {
            throw new IllegalArgumentException("stateName is required");
        }
        
        if (betLevel == null || betLevel.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("betLevel must be greater than 0");
        }
        
        if (years == null || years.isEmpty()) {
            throw new IllegalArgumentException("years must contain at least one year");
        }
        
        if (!Boolean.TRUE.equals(autoOptimizeGameOut) && (maxGameOut == null || maxGameOut < 1)) {
            throw new IllegalArgumentException("maxGameOut must be at least 1 (or set autoOptimizeGameOut to true)");
        }
        
        if (maxGameOut != null && maxGameOut < 1) {
            throw new IllegalArgumentException("maxGameOut must be at least 1");
        }
        
        if (hPoolSize != null && (hPoolSize < 1 || hPoolSize > 10)) {
            throw new IllegalArgumentException("hPoolSize must be between 1 and 10");
        }
        
        if (mPoolSize != null && (mPoolSize < 1 || mPoolSize > 10)) {
            throw new IllegalArgumentException("mPoolSize must be between 1 and 10");
        }
        
        if (poolSize != null && (poolSize < 10 || poolSize > 50)) {
            throw new IllegalArgumentException("poolSize must be between 10 and 50");
        }
    }
}
