package com.floyd.lottoptions.core.domain.gameout;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/**
 * How to wager a multi-game play: the order to play the games in, the capital thresholds to stop
 * or scale down at, the bet levels to move between, and what to do as results come in.
 *
 * @param recommendedSequence  the games' names in play order
 * @param sequencingRationale  why the games are in that order
 * @param scenarios            what to do after each outcome
 * @param capitalThresholds    the balances to stop or scale down at
 * @param betLevelAdjustments  the bet levels to move between
 */
public record WageringStrategy(
        List<String> recommendedSequence,
        String sequencingRationale,
        ScenarioGuidance scenarios,
        CapitalThresholds capitalThresholds,
        BetLevelAdjustments betLevelAdjustments) {

    public WageringStrategy {
        recommendedSequence = List.copyOf(Objects.requireNonNull(recommendedSequence, "recommendedSequence"));
        Objects.requireNonNull(sequencingRationale, "sequencingRationale");
        Objects.requireNonNull(scenarios, "scenarios");
        Objects.requireNonNull(capitalThresholds, "capitalThresholds");
        Objects.requireNonNull(betLevelAdjustments, "betLevelAdjustments");
    }

    /**
     * What to do after each outcome of the play.
     *
     * @param ifAllWin       when every game wins
     * @param ifFirstWins    when the first game wins
     * @param ifFirstLoses   when the first game loses
     * @param ifFirstTwoLose when the first two games lose
     * @param ifMajorityLose when more than half of the games lose
     */
    public record ScenarioGuidance(
            String ifAllWin,
            String ifFirstWins,
            String ifFirstLoses,
            String ifFirstTwoLose,
            String ifMajorityLose) {
    }

    /**
     * The balances at which to stop playing or scale the bet level down.
     *
     * @param stopLossBalance     stop playing below this balance
     * @param stopLossPercentage  the loss, in percent of the balance, that {@code stopLossBalance} allows
     * @param scaleDownBalance    scale the bet level down below this balance
     * @param scaleDownPercentage the loss, in percent of the balance, that {@code scaleDownBalance} allows
     * @param breakEvenBalance    the balance the play started from
     */
    public record CapitalThresholds(
            BigDecimal stopLossBalance,
            double stopLossPercentage,
            BigDecimal scaleDownBalance,
            double scaleDownPercentage,
            BigDecimal breakEvenBalance) {
    }

    /**
     * The bet levels to move between as the balance changes.
     *
     * @param currentLevel     the bet level played now
     * @param scaleDownLevel   the bet level to drop to after a loss
     * @param minimumLevel     the lowest bet level the platform accepts
     * @param scaleUpLevel     the bet level to climb to when the balance allows
     * @param scaleUpCondition when climbing to {@code scaleUpLevel} is allowed
     */
    public record BetLevelAdjustments(
            BigDecimal currentLevel,
            BigDecimal scaleDownLevel,
            BigDecimal minimumLevel,
            BigDecimal scaleUpLevel,
            String scaleUpCondition) {
    }
}
