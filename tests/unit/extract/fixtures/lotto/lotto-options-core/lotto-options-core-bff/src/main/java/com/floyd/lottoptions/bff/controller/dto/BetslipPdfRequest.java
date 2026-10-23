package com.floyd.lottoptions.bff.controller.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collections;
import java.util.List;

/**
 * BFF-level request body for {@code POST /ui/dashboard/{state}/{game}/betslip/pdf}.
 *
 * <p>State and game come from the URL path variables; this DTO carries only the
 * play data. The BFF merges path variables into a Core API request before forwarding
 * (FR-014-007).</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BetslipPdfRequest {

    /** One int[] per play; each array contains the selected main-pool numbers. */
    private List<int[]> numberSets;

    /**
     * Optional bonus number per play, parallel to {@code numberSets}.
     * Empty list means no bonus marking.
     */
    @Builder.Default
    private List<Integer> bonusNumbers = Collections.emptyList();

    /** Optional global option name (e.g. {@code "Cash"}, {@code "Annual"}). */
    private String globalOption;

    /** Color mode for the PDF. Defaults to {@code COLOR}. */
    @Builder.Default
    private String colorMode = "COLOR";
}
