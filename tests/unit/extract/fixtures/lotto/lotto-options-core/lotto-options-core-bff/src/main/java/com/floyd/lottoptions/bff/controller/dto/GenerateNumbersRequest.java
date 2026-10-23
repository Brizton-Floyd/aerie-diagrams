package com.floyd.lottoptions.bff.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * JSON request body for the Smart Generator endpoint
 * {@code POST /ui/dashboard/{state}/{game}/generate} (FR-013-DTO).
 *
 * <p>This BFF-owned DTO carries the four generation parameters supplied by the Angular UI.
 * The BFF service maps these fields plus the {@code state} and {@code game} path variables
 * into a {@code com.floyd.lottoptions.core.contract.generate.RandomNumberGeneratorRequest} before forwarding
 * to the Core API. No validation annotations are placed on the DTO fields themselves;
 * null-checking is applied at the service public-API boundary via
 * {@code Objects.requireNonNull} and explicit guards (Effective Java Items 49, 54).</p>
 *
 * <p>Immutable Java Record (Effective Java Item 17). No Lombok. {@code @Schema}-annotated
 * for OpenAPI auto-schema generation by SpringDoc (FR-013 Section 1.2 constraint 8).</p>
 *
 * @param numberGenerator      the already-mapped Core strategy value supplied by the UI
 *                             (e.g. {@code "LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN"},
 *                             {@code "SecureRandom"}, {@code "ThreadLocalRandom"})
 * @param numberSetsPerPattern number of ticket sets to generate per pattern
 * @param targetedPrizeLevel   prize-level index the user is targeting for estimation
 * @param drawDaysPerWeek      draw frequency used for elapsed-days estimation
 */
@Schema(description = "Request body for the Smart Generator number-generation endpoint")
public record GenerateNumbersRequest(

        @Schema(description = "Core strategy identifier supplied by the UI, "
                + "e.g. LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN, SecureRandom, ThreadLocalRandom")
        String numberGenerator,

        @Schema(description = "Number of ticket sets to generate per pattern")
        int numberSetsPerPattern,

        @Schema(description = "Prize-level index the user is targeting for win-probability estimation")
        int targetedPrizeLevel,

        @Schema(description = "Draw frequency (draws per week) used for elapsed-days estimation")
        int drawDaysPerWeek) {
}
