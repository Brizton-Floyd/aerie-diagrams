package com.floyd.lottoptions.bff.viewmodel;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Slim projection of a single prize-level result from the Core API's number-generation
 * response (FR-013-VM-PL, ADR-0003).
 *
 * <p>This record is a pure field-to-field projection of
 * {@code com.floyd.lottoptions.core.contract.generate.PrizeLevelResult}. The field
 * {@link #estimatedDaysToWin} is the BFF-layer rename of the Core field
 * {@code PrizeLevelResult.expectedElapsedDaysBeforeWin}, correcting a historical
 * mislabel in which a days-based estimate was surfaced under the "Expected Games Out"
 * label in the desktop UI (days ≠ games). The rename is the
 * {@code GeneratedNumbersAssembler}'s sole semantic contribution.</p>
 *
 * <p>Immutable Java Record (Effective Java Item 17). No Lombok.</p>
 *
 * @param correctNumbers    the number of correct picks required to win at this prize level
 * @param hits              the number of times this prize level has been hit in history
 * @param gamesOut          the number of draws since the last hit at this prize level
 * @param estimatedDaysToWin the estimated number of days before the next win at this prize
 *                           level, based on draw frequency; renamed from Core's
 *                           {@code expectedElapsedDaysBeforeWin}
 */
@Schema(description = "Per-prize-level result from the number-generation response")
public record PrizeLevelViewModel(

        @Schema(description = "Number of correct picks required to win at this prize level")
        int correctNumbers,

        @Schema(description = "Number of times this prize level has been hit in draw history")
        int hits,

        @Schema(description = "Number of draws since the last hit at this prize level")
        int gamesOut,

        @Schema(description = "Estimated days before the next win at this prize level "
                + "(renamed from Core's expectedElapsedDaysBeforeWin)")
        double estimatedDaysToWin) {
}
