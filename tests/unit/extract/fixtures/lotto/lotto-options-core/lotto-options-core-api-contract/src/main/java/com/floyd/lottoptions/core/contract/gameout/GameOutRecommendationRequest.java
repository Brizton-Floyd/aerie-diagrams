package com.floyd.lottoptions.core.contract.gameout;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

/**
 * Request body of {@code POST /api/v1/gameout/recommendation}: one game's next-draw
 * recommendation.
 *
 * <p>A mutable bean, so an absent property keeps its default ({@code hPoolSize} 6,
 * {@code mPoolSize} 8, {@code riskLevel} {@code LOW}, both flags {@code false}) while an explicit
 * {@code null} clears it. Core validates the request; a request that breaks a rule answers 400.</p>
 */
public class GameOutRecommendationRequest {

    private String gameId;
    private String state;
    private BigDecimal betLevel;
    private Integer maxGameOut;
    @JsonProperty("hPoolSize")
    private Integer hPoolSize = 6;
    @JsonProperty("mPoolSize")
    private Integer mPoolSize = 8;
    private Boolean includeHistoricalPerformance = false;
    private Integer performanceYear;
    private List<Integer> performanceYears;
    private BigDecimal startingBalance;
    private RiskLevel riskLevel = RiskLevel.LOW;
    private Integer poolSize;
    private Boolean autoOptimizeGameOut = false;

    public String getGameId() {
        return gameId;
    }

    public void setGameId(String gameId) {
        this.gameId = gameId;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public BigDecimal getBetLevel() {
        return betLevel;
    }

    public void setBetLevel(BigDecimal betLevel) {
        this.betLevel = betLevel;
    }

    public Integer getMaxGameOut() {
        return maxGameOut;
    }

    public void setMaxGameOut(Integer maxGameOut) {
        this.maxGameOut = maxGameOut;
    }

    @JsonProperty("hPoolSize")
    public Integer getHPoolSize() {
        return hPoolSize;
    }

    @JsonProperty("hPoolSize")
    public void setHPoolSize(Integer hPoolSize) {
        this.hPoolSize = hPoolSize;
    }

    @JsonProperty("mPoolSize")
    public Integer getMPoolSize() {
        return mPoolSize;
    }

    @JsonProperty("mPoolSize")
    public void setMPoolSize(Integer mPoolSize) {
        this.mPoolSize = mPoolSize;
    }

    public Boolean getIncludeHistoricalPerformance() {
        return includeHistoricalPerformance;
    }

    public void setIncludeHistoricalPerformance(Boolean includeHistoricalPerformance) {
        this.includeHistoricalPerformance = includeHistoricalPerformance;
    }

    public Integer getPerformanceYear() {
        return performanceYear;
    }

    public void setPerformanceYear(Integer performanceYear) {
        this.performanceYear = performanceYear;
    }

    public List<Integer> getPerformanceYears() {
        return performanceYears;
    }

    public void setPerformanceYears(List<Integer> performanceYears) {
        this.performanceYears = performanceYears;
    }

    public BigDecimal getStartingBalance() {
        return startingBalance;
    }

    public void setStartingBalance(BigDecimal startingBalance) {
        this.startingBalance = startingBalance;
    }

    public RiskLevel getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(RiskLevel riskLevel) {
        this.riskLevel = riskLevel;
    }

    public Integer getPoolSize() {
        return poolSize;
    }

    public void setPoolSize(Integer poolSize) {
        this.poolSize = poolSize;
    }

    public Boolean getAutoOptimizeGameOut() {
        return autoOptimizeGameOut;
    }

    public void setAutoOptimizeGameOut(Boolean autoOptimizeGameOut) {
        this.autoOptimizeGameOut = autoOptimizeGameOut;
    }
}
