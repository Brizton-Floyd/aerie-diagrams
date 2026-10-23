package com.floyd.lottoptions.core.contract.betslip;

import java.util.List;

/**
 * Request body of {@code POST /api/v1/betslip/pdf}: the plays to mark on a game's betslips.
 *
 * <p>Core reads an absent {@code bonusNumbers} as no bonus numbers and an absent
 * {@code colorMode} as {@link ColorMode#COLOR}. A record's arrays compare by identity, so two
 * requests with equal plays are not {@code equals}.</p>
 *
 * @param state        the state's name (for example "Texas")
 * @param game         the game's full name (for example "Cash Five")
 * @param numberSets   one array of main numbers per play; Core rejects a request without any
 * @param bonusNumbers the bonus number per play, parallel to {@code numberSets}; a missing or
 *                     {@code null} entry marks no bonus for that play
 * @param globalOption the global option to mark (for example "Cash"); {@code null} or blank
 *                     asks for the slip's default
 * @param colorMode    how the slips are printed
 */
public record BetslipPdfRequest(String state, String game, List<int[]> numberSets, List<Integer> bonusNumbers,
                                String globalOption, ColorMode colorMode) {

    /** How the slips are printed. */
    public enum ColorMode {
        COLOR,
        BLACK_AND_WHITE,
        SCANNER_READY
    }
}
