package com.floyd.lottoptions.legacy.desktop.quality;

/**
 * Represents a user's targeting request with preferences and configuration.
 * Contains all parameters needed to generate and evaluate lottery tickets
 * according to user specifications.
 */
public class UserTargetingRequest {
    
    private final String userId;
    private final String targetTier;
    private final int numberOfTickets;
    private final String generationStrategy;
    private final double budget;
    private final String lotteryConfigId;
    private final String lotteryState;
    private final String lotteryGame;
    private final UserPreferences preferences;

    /**
     * Constructs a UserTargetingRequest with all required parameters.
     *
     * @param userId The user identifier
     * @param targetTier The target prize tier (e.g., "5-of-6", "4-of-5", "tier_2", "jackpot")
     * @param numberOfTickets Number of tickets to generate
     * @param generationStrategy Strategy for generation (PATTERN_BASED, RANDOM, HYBRID)
     * @param budget The user's budget for this targeting session
     * @param lotteryConfigId The lottery game identifier
     * @param lotteryState The state where the lottery is played (e.g., "texas", "california")
     * @param lotteryGame The specific lottery game name (e.g., "cash-five", "powerball")
     * @param preferences User's specific preferences and constraints
     */
    public UserTargetingRequest(String userId, String targetTier, int numberOfTickets, 
                               String generationStrategy, double budget, String lotteryConfigId,
                               String lotteryState, String lotteryGame, UserPreferences preferences) {
        this.userId = userId;
        this.targetTier = targetTier;
        this.numberOfTickets = numberOfTickets;
        this.generationStrategy = generationStrategy;
        this.budget = budget;
        this.lotteryConfigId = lotteryConfigId;
        this.lotteryState = lotteryState;
        this.lotteryGame = lotteryGame;
        this.preferences = preferences;
    }

    /**
     * Gets the user identifier.
     *
     * @return The user ID
     */
    public String getUserId() {
        return userId;
    }

    /**
     * Gets the target prize tier.
     *
     * @return The target tier (e.g., "5-of-6", "4-of-5", "tier_2", "jackpot")
     */
    public String getTargetTier() {
        return targetTier;
    }

    /**
     * Gets the number of tickets requested.
     *
     * @return The number of tickets
     */
    public int getNumberOfTickets() {
        return numberOfTickets;
    }

    /**
     * Gets the generation strategy.
     *
     * @return The strategy (PATTERN_BASED, RANDOM, HYBRID)
     */
    public String getGenerationStrategy() {
        return generationStrategy;
    }

    /**
     * Gets the user's budget.
     *
     * @return The budget amount
     */
    public double getBudget() {
        return budget;
    }

    /**
     * Gets the lottery configuration identifier.
     *
     * @return The lottery config ID
     */
    public String getLotteryConfigId() {
        return lotteryConfigId;
    }

    /**
     * Gets the lottery state.
     *
     * @return The state where the lottery is played
     */
    public String getLotteryState() {
        return lotteryState;
    }

    /**
     * Gets the lottery game name.
     *
     * @return The specific lottery game name
     */
    public String getLotteryGame() {
        return lotteryGame;
    }

    /**
     * Gets the user's preferences.
     *
     * @return The user preferences object
     */
    public UserPreferences getPreferences() {
        return preferences;
    }
    
    /**
     * Gets the target quality score from user preferences.
     *
     * @return The target quality score (0-100)
     */
    public double getTargetQualityScore() {
        return preferences != null ? preferences.getMinQualityScore() : 50.0;
    }
    
    /**
     * Convenience method for getting ticket count (alias for getNumberOfTickets).
     *
     * @return The number of tickets requested
     */
    public int getTicketCount() {
        return numberOfTickets;
    }
    
    /**
     * Checks if Delta strategy is enabled in user preferences.
     *
     * @return true if Delta strategy should be used
     */
    public boolean isDeltaStrategyEnabled() {
        return preferences != null && preferences.isEnableDeltaStrategy();
    }
    
    /**
     * Gets the delta-specific preferences from user preferences.
     * 
     * @return UserPreferences containing delta configuration, or null if not available
     */
    public UserPreferences getDeltaPreferences() {
        return preferences;
    }

    /**
     * Creates a builder for UserTargetingRequest.
     *
     * @return A new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for UserTargetingRequest.
     */
    public static class Builder {
        private String userId;
        private String targetTier = "5-of-6"; // Default to 5 matches out of 6 (common secondary prize)
        private int numberOfTickets = 10;
        private String generationStrategy = "PATTERN_BASED";
        private double budget = 20.0;
        private String lotteryConfigId;
        private String lotteryState;
        private String lotteryGame;
        private UserPreferences preferences = new UserPreferences();

        public Builder userId(String userId) {
            this.userId = userId;
            return this;
        }

        public Builder targetTier(String targetTier) {
            this.targetTier = targetTier;
            return this;
        }

        public Builder numberOfTickets(int numberOfTickets) {
            this.numberOfTickets = numberOfTickets;
            return this;
        }

        public Builder generationStrategy(String generationStrategy) {
            this.generationStrategy = generationStrategy;
            return this;
        }

        public Builder budget(double budget) {
            this.budget = budget;
            return this;
        }

        public Builder lotteryConfigId(String lotteryConfigId) {
            this.lotteryConfigId = lotteryConfigId;
            return this;
        }

        public Builder lotteryState(String lotteryState) {
            this.lotteryState = lotteryState;
            return this;
        }

        public Builder lotteryGame(String lotteryGame) {
            this.lotteryGame = lotteryGame;
            return this;
        }

        public Builder preferences(UserPreferences preferences) {
            this.preferences = preferences;
            return this;
        }

        public UserTargetingRequest build() {
            if (userId == null || lotteryConfigId == null) {
                throw new IllegalStateException("userId and lotteryConfigId are required");
            }
            return new UserTargetingRequest(userId, targetTier, numberOfTickets, 
                                          generationStrategy, budget, lotteryConfigId, 
                                          lotteryState, lotteryGame, preferences);
        }
    }

    @Override
    public String toString() {
        return String.format("UserTargetingRequest{userId='%s', tier='%s', tickets=%d, strategy='%s', config='%s'}",
                userId, targetTier, numberOfTickets, generationStrategy, lotteryConfigId);
    }
}