package com.floyd.lottoptions.bff.viewmodel;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * Slim projection of the Core API's number-generation response, consumed by the
 * Angular Smart Generator screen (FR-013-VM, ADR-0003).
 *
 * <p>This record is assembled from {@code com.floyd.lottoptions.core.contract.generate.GeneratedNumberData}
 * by {@code GeneratedNumbersAssembler}. The field {@link #estimatedDaysToWinTargeted} is the
 * BFF-layer rename of the Core scalar
 * {@code GeneratedNumberData.estimatedElapsedDaysForTargetedPrizeLevelWin}, correcting the
 * historical naming for clarity. Per-prize-level renaming is documented on
 * {@link PrizeLevelViewModel#estimatedDaysToWin()}.</p>
 *
 * <p>Immutable Java Record (Effective Java Item 17). No Lombok.
 * {@link #prizeLevels()} is never {@code null} - the assembler substitutes
 * {@code List.of()} when the Core response carries a {@code null} list
 * (Effective Java Item 54).</p>
 *
 * @param sets                         the generated number sets; each {@code int[]} is one ticket
 * @param prizeLevels                  per-prize-level statistics; never {@code null}, may be empty
 * @param totalTickets                 total number of tickets generated
 * @param estimatedDaysToWinTargeted   estimated days before the targeted prize level is won;
 *                                     renamed from Core's
 *                                     {@code estimatedElapsedDaysForTargetedPrizeLevelWin}
 */
@Schema(description = "Generated number sets and prize-level statistics from the Smart Generator")
public record GeneratedNumbersViewModel(

        @Schema(description = "Generated number sets; each array is one ticket")
        List<int[]> sets,

        @Schema(description = "Per-prize-level statistics; never null")
        List<PrizeLevelViewModel> prizeLevels,

        @Schema(description = "Total number of tickets generated")
        int totalTickets,

        @Schema(description = "Estimated days before the targeted prize level is won "
                + "(renamed from Core's estimatedElapsedDaysForTargetedPrizeLevelWin)")
        double estimatedDaysToWinTargeted) {
}
