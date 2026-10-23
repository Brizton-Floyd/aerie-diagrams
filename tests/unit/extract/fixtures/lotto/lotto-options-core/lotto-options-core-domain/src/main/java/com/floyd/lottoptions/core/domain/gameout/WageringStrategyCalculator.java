package com.floyd.lottoptions.core.domain.gameout;

import java.math.BigDecimal;
import java.util.List;

/**
 * Pure, stateless calculator for wagering and capital-management guidance (FR-026).
 *
 * <p>Derives the balance-based recommended bet level, scale-up / scale-down bet
 * levels, and the full multi-state wagering strategy (play sequence, capital
 * thresholds such as stop-loss and scale-down, bet-level adjustments, and
 * scenario guidance).</p>
 *
 * <p>Extracted verbatim from {@code GameOutRecommendationService}; behavior is
 * identical. A plain stateless class (ADR-0008): a single instance is safely
 * shared and trivially unit-testable.</p>
 */
public final class WageringStrategyCalculator {

    /** The lowest wager the platform accepts per combination. */
    private static final BigDecimal MIN_BET_LEVEL = new BigDecimal("0.25");

    // Note: the recommended bet level is balance-derived by design; risk level does
    // not influence it (risk gates maxAllowedSpend instead, in the orchestrator).
    public BigDecimal calculateRecommendedBetLevel(BigDecimal accountBalance) {
        BigDecimal balance = accountBalance;

        if (balance.compareTo(new BigDecimal("10000")) >= 0) {
            return new BigDecimal("2.00");
        } else if (balance.compareTo(new BigDecimal("5000")) >= 0) {
            return new BigDecimal("1.00");
        } else if (balance.compareTo(new BigDecimal("2000")) >= 0) {
            return new BigDecimal("0.50");
        } else {
            // Any balance below $2,000 maps to the minimum bet level. (The former
            // separate < $500 branch returned the same 0.25 and was dead.)
            return MIN_BET_LEVEL;
        }
    }

    public WageringStrategy calculateWageringStrategy(
            List<SelectedGame> selectedGames,
            BigDecimal accountBalance,
            BigDecimal currentBetLevel) {

        List<String> recommendedSequence = selectedGames.stream()
            .map(SelectedGame::gameId)
            .toList();

        String sequencingRationale = "Games ordered by priority score (ROI × 0.6 + Game-Out Value × 0.4). " +
            "Play highest priority games first to maximize expected value.";

        double stopLossPercentage = 20.0;
        BigDecimal stopLossBalance = accountBalance.multiply(BigDecimal.valueOf(0.80));

        double scaleDownPercentage = 10.0;
        BigDecimal scaleDownBalance = accountBalance.multiply(BigDecimal.valueOf(0.90));

        BigDecimal breakEvenBalance = accountBalance;

        WageringStrategy.CapitalThresholds thresholds = new WageringStrategy.CapitalThresholds(
            stopLossBalance,
            stopLossPercentage,
            scaleDownBalance,
            scaleDownPercentage,
            breakEvenBalance);

        BigDecimal scaleDownLevel = calculateScaleDownBetLevel(currentBetLevel);
        BigDecimal minimumLevel = MIN_BET_LEVEL;
        BigDecimal scaleUpLevel = calculateScaleUpBetLevel(currentBetLevel);

        WageringStrategy.BetLevelAdjustments betLevelAdjustments = new WageringStrategy.BetLevelAdjustments(
            currentBetLevel,
            scaleDownLevel,
            minimumLevel,
            scaleUpLevel,
            "Only scale up if current balance exceeds starting balance AND daily P/L is positive");

        BigDecimal firstGameCost = selectedGames.isEmpty() ? BigDecimal.ZERO : selectedGames.get(0).totalCost();

        BigDecimal firstTwoCost = BigDecimal.ZERO;
        if (selectedGames.size() >= 2) {
            firstTwoCost = firstGameCost.add(selectedGames.get(1).totalCost());
        }

        WageringStrategy.ScenarioGuidance scenarios = new WageringStrategy.ScenarioGuidance(
            String.format("Excellent! Continue with current bet level ($%s). " +
                "Consider scaling up to $%s only if balance significantly exceeds starting amount.",
                currentBetLevel, scaleUpLevel),
            String.format("Good start! Maintain current bet level ($%s) for remaining %d games. " +
                "Your buffer has increased, proceed with confidence.",
                currentBetLevel, selectedGames.size() - 1),
            String.format("First game lost ($%s). Reduce bet level to $%s for remaining %d games " +
                "to preserve capital. Stop if balance drops below $%s.",
                firstGameCost, scaleDownLevel, selectedGames.size() - 1, scaleDownBalance),
            String.format("Two consecutive losses ($%s total). STOP PLAYING for the day. " +
                "Your balance is at risk. Resume tomorrow with fresh analysis.",
                firstTwoCost),
            String.format("If more than half of games lose, STOP immediately. " +
                "Do not chase losses. Preserve remaining capital ($%s minimum) for future opportunities.",
                stopLossBalance));

        return new WageringStrategy(
            recommendedSequence,
            sequencingRationale,
            scenarios,
            thresholds,
            betLevelAdjustments);
    }

    public BigDecimal calculateScaleDownBetLevel(BigDecimal currentLevel) {
        if (currentLevel.compareTo(new BigDecimal("1.00")) >= 0) {
            return new BigDecimal("0.50");
        } else if (currentLevel.compareTo(new BigDecimal("0.50")) >= 0) {
            return new BigDecimal("0.25");
        }
        return new BigDecimal("0.25");
    }

    public BigDecimal calculateScaleUpBetLevel(BigDecimal currentLevel) {
        if (currentLevel.compareTo(new BigDecimal("0.25")) == 0) {
            return new BigDecimal("0.50");
        } else if (currentLevel.compareTo(new BigDecimal("0.50")) == 0) {
            return new BigDecimal("1.00");
        } else if (currentLevel.compareTo(new BigDecimal("1.00")) == 0) {
            return new BigDecimal("2.00");
        }
        return currentLevel.multiply(new BigDecimal("2"));
    }
}
